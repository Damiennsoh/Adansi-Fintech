"""Contribution endpoints with full CRUD and Hubtel callback handling."""
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from decimal import Decimal

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.momo_service import momo_service
from app.services.credit_service import credit_engine
from app.services.notification_service import notification_service
from app.schemas.contribution import ContributionCreateRequest, ContributionResponse, MomoCallbackPayload
from app.models import Contribution, Group, GroupMember, User, Transaction, AuditEvent

router = APIRouter(prefix="/contributions", tags=["Contributions"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contribution(
    request: ContributionCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Initiate contribution. Creates pending record + calls MoMo API."""
    # Verify user is group member
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == request.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await db.get(Group, request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Create pending contribution record
    contribution = Contribution(
        group_id=request.group_id,
        user_id=current_user.id,
        amount=request.amount,
        method=request.method,
        status="pending"
    )
    db.add(contribution)
    await db.flush()  # Get ID without committing

    # Generate transaction reference
    transaction_ref = f"ADNS-CONT-{contribution.id.hex[:8].upper()}"
    contribution.transaction_ref = transaction_ref
    await db.commit()
    await db.refresh(contribution)

    # Call MoMo API to request payment
    result = await momo_service.request_payment(
        phone=current_user.phone,
        amount=request.amount,
        description=f"ADANSI contribution to {group.name}",
        callback_url=f"https://your-api.com/api/v1/contributions/webhook/hubtel"
    )

    if not result["success"]:
        contribution.status = "failed"
        await db.commit()
        raise HTTPException(status_code=502, detail=f"MoMo request failed: {result.get('hubtel_response')}")

    return {
        "message": "Payment request initiated",
        "contribution_id": str(contribution.id),
        "transaction_ref": transaction_ref,
        "amount": float(request.amount),
        "status": "pending",
        "instructions": "Please confirm the payment prompt on your phone."
    }


@router.get("/{contribution_id}")
async def get_contribution(contribution_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get contribution details and status."""
    contribution = await db.get(Contribution, contribution_id)
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    # Verify user can see this (member of group)
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == contribution.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    return contribution


@router.post("/{contribution_id}/verify")
async def verify_contribution(
    contribution_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually verify a pending contribution (admin/treasurer)."""
    contribution = await db.get(Contribution, contribution_id)
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    # Verify admin/treasurer role
    role_check = await db.execute(
        select(GroupMember.role).where(
            GroupMember.group_id == contribution.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    role = role_check.scalar_one_or_none()
    if role not in ["admin", "treasurer"]:
        raise HTTPException(status_code=403, detail="Only admins or treasurers can verify")

    if contribution.status != "pending":
        raise HTTPException(status_code=400, detail=f"Contribution is already {contribution.status}")

    # Idempotency guard: a completed transaction can never be posted twice.
    existing_transaction = await db.scalar(select(Transaction).where(Transaction.reference == contribution.transaction_ref))
    if existing_transaction:
        return {"message": "Contribution already settled", "contribution_id": str(contribution_id), "status": "completed"}

    # Mark as completed
    contribution.status = "completed"

    # Update group balance
    group = await db.get(Group, contribution.group_id)
    group.current_balance += contribution.amount

    # Update member totals
    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == contribution.group_id,
            GroupMember.user_id == contribution.user_id
        )
    )
    member = member.scalar_one_or_none()
    if member:
        member.total_contributed += contribution.amount
        member.last_contribution_at = contribution.created_at

    # Update user totals
    user = await db.get(User, contribution.user_id)
    user.total_contributed += contribution.amount

    # Create audit transaction
    transaction = Transaction(
        type="contribution",
        reference=contribution.transaction_ref,
        amount=contribution.amount,
        group_id=contribution.group_id,
        user_id=contribution.user_id,
        status="completed",
        external_ref=contribution.momo_transaction_id
    )
    db.add(transaction)
    db.add(AuditEvent(group_id=contribution.group_id, actor_id=current_user.id, event_type="contribution_settled", entity_type="contribution", entity_id=contribution.id, amount=contribution.amount, event_metadata={"reference": contribution.transaction_ref, "method": contribution.method}))

    await db.commit()

    # Trigger async credit score update
    await credit_engine.calculate_score(contribution.user_id)

    return {"message": "Contribution verified and completed", "contribution_id": str(contribution_id)}


@router.post("/webhook/hubtel")
async def hubtel_callback(
    payload: MomoCallbackPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Hubtel payment callback webhook. Processes async payment confirmations."""
    is_valid = await momo_service.verify_callback(payload.model_dump())
    if not is_valid:
        return {"status": "ignored", "reason": "Invalid callback signature or response code"}

    data = payload.Data
    client_ref = data.get("ClientReference")
    transaction_id = data.get("TransactionId")
    amount = Decimal(str(data.get("Amount", 0)))
    phone = data.get("CustomerMsisdn")
    status = data.get("Status", "").lower()

    if not client_ref:
        return {"status": "ignored", "reason": "Missing ClientReference"}

    # Find contribution by reference
    result = await db.execute(
        select(Contribution).where(Contribution.transaction_ref == client_ref)
    )
    contribution = result.scalar_one_or_none()

    if not contribution:
        return {"status": "ignored", "reason": "Contribution not found"}

    existing_transaction = await db.scalar(select(Transaction).where(Transaction.reference == client_ref))
    if contribution.status != "pending" or existing_transaction:
        return {"status": "ignored", "reason": "Already processed"}

    if status == "success":
        contribution.status = "completed"
        contribution.momo_transaction_id = transaction_id

        # Update group balance
        group = await db.get(Group, contribution.group_id)
        group.current_balance += contribution.amount

        # Update member totals
        member = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == contribution.group_id,
                GroupMember.user_id == contribution.user_id
            )
        )
        member = member.scalar_one_or_none()
        if member:
            member.total_contributed += contribution.amount
            member.last_contribution_at = contribution.created_at

        # Update user totals
        user = await db.get(User, contribution.user_id)
        user.total_contributed += contribution.amount

        # Create audit transaction
        transaction = Transaction(
            type="contribution",
            reference=client_ref,
            amount=amount,
            group_id=contribution.group_id,
            user_id=contribution.user_id,
            status="completed",
            external_ref=transaction_id
        )
        db.add(transaction)
        db.add(AuditEvent(group_id=contribution.group_id, actor_id=None, event_type="contribution_settled", entity_type="contribution", entity_id=contribution.id, amount=contribution.amount, event_metadata={"reference": client_ref, "provider": "hubtel", "external_ref": transaction_id}))

        await db.commit()

        # Send notification to group members
        await notification_service.send_contribution_alert(
            phone=user.phone,
            contributor_name=user.full_name,
            amount=float(amount),
            group_name=group.name,
            new_balance=float(group.current_balance)
        )

        # Recalculate credit score
        await credit_engine.calculate_score(contribution.user_id)

        return {"status": "processed", "contribution_id": str(contribution.id), "result": "completed"}

    else:
        # Payment failed
        contribution.status = "failed"
        await db.commit()
        return {"status": "processed", "contribution_id": str(contribution.id), "result": "failed", "reason": data.get("Message")}
