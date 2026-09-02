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
from app.services.history_service import mark_contribution_on_schedule, ensure_schedules_for_member
from app.services.group_service import group_service

router = APIRouter(prefix="/contributions", tags=["Contributions"])


async def settle_contribution(db: AsyncSession, contribution: Contribution, actor_id=None, provider: str = "sandbox", external_ref: str | None = None):
    """Post one completed contribution to every financial source of truth."""
    if await db.scalar(select(Transaction).where(Transaction.reference == contribution.transaction_ref)):
        return
    contribution.status = "completed"
    contribution.momo_transaction_id = external_ref or contribution.momo_transaction_id
    group = await db.get(Group, contribution.group_id)
    if group:
        await group_service.reconcile_group_balance(db, contribution.group_id)
    member = await db.scalar(select(GroupMember).where(GroupMember.group_id == contribution.group_id, GroupMember.user_id == contribution.user_id))
    if member:
        member.total_contributed += contribution.amount
        member.last_contribution_at = contribution.created_at
    user = await db.get(User, contribution.user_id)
    if user:
        user.total_contributed += contribution.amount
    db.add(Transaction(type="contribution", reference=contribution.transaction_ref, amount=contribution.amount, group_id=contribution.group_id, user_id=contribution.user_id, status="completed", external_ref=external_ref or contribution.transaction_ref))
    db.add(AuditEvent(group_id=contribution.group_id, actor_id=actor_id, event_type="contribution_settled", entity_type="contribution", entity_id=contribution.id, amount=contribution.amount, event_metadata={"reference": contribution.transaction_ref, "method": contribution.method, "provider": provider}))


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
        status="pending",
        meta_data={
            "network": request.network,
            "payer_name": request.payer_name or current_user.full_name,
            "method": request.method,
        },
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
        network=request.network,
    )

    if not result["success"]:
        contribution.status = "failed"
        await db.commit()
        raise HTTPException(status_code=502, detail=f"MoMo request failed: {result.get('hubtel_response')}")

    if result.get("sandbox"):
        await settle_contribution(db, contribution, current_user.id, provider="sandbox", external_ref=result.get("reference"))
        await db.commit()
        return {"message": "Payment completed in local sandbox", "contribution_id": str(contribution.id), "transaction_ref": transaction_ref, "amount": float(request.amount), "status": "completed", "sandbox": True}

    return {
        "message": "Payment request initiated",
        "contribution_id": str(contribution.id),
        "transaction_ref": transaction_ref,
        "amount": float(request.amount),
        "status": "pending",
        "instructions": "Please confirm the payment prompt on your phone."
    }


async def ensure_guest_user(db: AsyncSession, payer_name: str | None) -> User:
    """Create a lightweight guest user for public one-time contributions without creating a group membership."""
    guest_name = (payer_name or "Guest Contributor").strip() or "Guest Contributor"
    result = await db.execute(
        select(User).where(User.full_name == guest_name).order_by(User.created_at.desc()).limit(1)
    )
    guest = result.scalar_one_or_none()
    if guest:
        return guest

    guest = User(full_name=guest_name, role="user", is_active=True)
    db.add(guest)
    await db.flush()
    return guest


@router.post("/guest", status_code=status.HTTP_201_CREATED)
async def create_guest_contribution(
    request: ContributionCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a contribution from a public guest link without creating a group membership."""
    group = await db.get(Group, request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    guest_user = await ensure_guest_user(db, request.payer_name)
    if request.method == "momo" and not request.payer_phone:
        raise HTTPException(status_code=400, detail="A MoMo number is required")

    contribution = Contribution(
        group_id=request.group_id,
        user_id=guest_user.id,
        amount=request.amount,
        method=request.method,
        status="pending",
        meta_data={
            "network": request.network,
            "payer_name": request.payer_name or guest_user.full_name,
            "guest": True,
            "method": request.method,
            "payer_phone": request.payer_phone,
        },
    )
    db.add(contribution)
    await db.flush()

    transaction_ref = f"ADNS-GUEST-{contribution.id.hex[:8].upper()}"
    contribution.transaction_ref = transaction_ref

    if request.method == "card":
        await settle_contribution(db, contribution, provider="card", external_ref=transaction_ref)
    elif request.method == "momo":
        provider_result = await momo_service.request_payment(
            phone=request.payer_phone,
            amount=request.amount,
            description=f"ADANSI guest contribution to {group.name}",
            network=request.network,
        )
        if not provider_result["success"]:
            contribution.status = "failed"
            await db.commit()
            raise HTTPException(status_code=502, detail="MoMo payment request failed")
        contribution.transaction_ref = provider_result["reference"]
        if provider_result.get("sandbox"):
            await settle_contribution(db, contribution, provider="sandbox", external_ref=provider_result.get("reference"))

    await db.commit()
    await db.refresh(contribution)

    return {
        "message": "Contribution recorded",
        "contribution_id": str(contribution.id),
        "transaction_ref": contribution.transaction_ref,
        "amount": float(request.amount),
        "status": contribution.status,
        "guest": True,
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
    contribution = await db.scalar(select(Contribution).where(Contribution.id == contribution_id).with_for_update())
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

    # Reconcile the group balance from actual ledger totals
    group = await db.get(Group, contribution.group_id)
    if group:
        await group_service.reconcile_group_balance(db, contribution.group_id)

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

    if group and group.contribution_amount and group.contribution_frequency:
        await ensure_schedules_for_member(
            db, contribution.group_id, contribution.user_id,
            group.contribution_amount, group.contribution_frequency,
        )
    await mark_contribution_on_schedule(db, contribution)

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
        select(Contribution).where(Contribution.transaction_ref == client_ref).with_for_update()
    )
    contribution = result.scalar_one_or_none()

    if not contribution:
        return {"status": "ignored", "reason": "Contribution not found"}

    existing_transaction = await db.scalar(select(Transaction).where(Transaction.reference == client_ref))
    if contribution.status != "pending" or existing_transaction:
        return {"status": "ignored", "reason": "Already processed"}
    if status == "success" and amount != Decimal(str(contribution.amount)):
        contribution.status = "failed"
        await db.commit()
        return {"status": "ignored", "reason": "Callback amount mismatch"}

    if status == "success":
        contribution.status = "completed"
        contribution.momo_transaction_id = transaction_id

        # Reconcile the group balance from actual ledger totals
        group = await db.get(Group, contribution.group_id)
        if group:
            await group_service.reconcile_group_balance(db, contribution.group_id)

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

        if group and group.contribution_amount and group.contribution_frequency:
            await ensure_schedules_for_member(
                db, contribution.group_id, contribution.user_id,
                group.contribution_amount, group.contribution_frequency,
            )
        await mark_contribution_on_schedule(db, contribution)

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
