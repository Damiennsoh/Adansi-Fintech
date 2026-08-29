"""Withdrawal endpoints with full approval workflow."""
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.momo_service import momo_service
from app.services.notification_service import notification_service
from app.services.credit_service import credit_engine
from app.schemas.withdrawal import (
    WithdrawalCreateRequest, WithdrawalApprovalRequest,
    AgentVerifyRequest, WithdrawalResponse
)
from app.models import Withdrawal, WithdrawalApproval, Group, GroupMember, User, Transaction

router = APIRouter(prefix="/withdrawals", tags=["Withdrawals"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def request_withdrawal(
    request: WithdrawalCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Request withdrawal from group. Triggers approval workflow."""
    # Verify user is treasurer or admin
    role_check = await db.execute(
        select(GroupMember.role).where(
            GroupMember.group_id == request.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    role = role_check.scalar_one_or_none()
    if role not in ["admin", "treasurer"]:
        raise HTTPException(status_code=403, detail="Only admins or treasurers can request withdrawals")

    group = await db.get(Group, request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.current_balance < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient group balance")

    # Check if agent verification is needed
    needs_agent = group.agent_verification_required and request.amount >= group.withdrawal_threshold

    # Create withdrawal record
    withdrawal = Withdrawal(
        group_id=request.group_id,
        requested_by=current_user.id,
        amount=request.amount,
        reason=request.reason,
        status="pending",
        approval_required=max(2, len(group.members) // 2)  # At least 2 approvals, or half of members
    )
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)

    # Notify all group members for approval
    for member in group.members:
        if member.user_id != current_user.id:
            user = await db.get(User, member.user_id)
            if user:
                await notification_service.send_withdrawal_request(
                    phone=user.phone,
                    requester_name=current_user.full_name,
                    amount=float(request.amount),
                    group_name=group.name,
                    withdrawal_id=str(withdrawal.id)[:8]
                )

    return {
        "message": "Withdrawal request submitted",
        "withdrawal_id": str(withdrawal.id),
        "amount": float(request.amount),
        "approvals_required": withdrawal.approval_required,
        "needs_agent_verification": needs_agent,
        "status": "pending"
    }


@router.get("/{withdrawal_id}")
async def get_withdrawal(withdrawal_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get withdrawal status and approvals received."""
    withdrawal = await db.get(Withdrawal, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    # Verify user is group member
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == withdrawal.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    # Get approval details
    approvals_result = await db.execute(
        select(WithdrawalApproval).where(WithdrawalApproval.withdrawal_id == withdrawal_id)
    )
    approvals = approvals_result.scalars().all()

    return {
        "withdrawal_id": str(withdrawal.id),
        "group_id": str(withdrawal.group_id),
        "amount": float(withdrawal.amount),
        "reason": withdrawal.reason,
        "status": withdrawal.status,
        "approval_count": withdrawal.approval_count,
        "approval_required": withdrawal.approval_required,
        "approvals": [
            {"member_id": str(a.member_id), "approved": a.approved, "channel": a.channel}
            for a in approvals
        ],
        "agent_verified": withdrawal.agent_verified_at is not None,
        "created_at": withdrawal.created_at
    }


@router.post("/{withdrawal_id}/approve")
async def approve_withdrawal(
    withdrawal_id: UUID,
    request: WithdrawalApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Member approves or rejects a pending withdrawal."""
    withdrawal = await db.get(Withdrawal, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal.status}")

    # Verify user is group member
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == withdrawal.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    # Check if already voted
    existing = await db.execute(
        select(WithdrawalApproval).where(
            WithdrawalApproval.withdrawal_id == withdrawal_id,
            WithdrawalApproval.member_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already voted on this withdrawal")

    # Record approval
    approval = WithdrawalApproval(
        withdrawal_id=withdrawal_id,
        member_id=current_user.id,
        approved=request.approved,
        channel="pwa"
    )
    db.add(approval)

    if request.approved:
        withdrawal.approval_count += 1

    await db.commit()

    # Check if enough approvals
    if withdrawal.approval_count >= withdrawal.approval_required:
        group = await db.get(Group, withdrawal.group_id)

        if group.agent_verification_required and withdrawal.amount >= group.withdrawal_threshold:
            withdrawal.status = "agent_pending"
            # Notify agents (mock for now)
        else:
            withdrawal.status = "approved"

        await db.commit()

    return {
        "message": "Approval recorded",
        "approved": request.approved,
        "approvals_received": withdrawal.approval_count,
        "approvals_required": withdrawal.approval_required,
        "status": withdrawal.status
    }


@router.post("/{withdrawal_id}/agent-verify")
async def agent_verify_withdrawal(
    withdrawal_id: UUID,
    request: AgentVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """Agent submits verification for a withdrawal."""
    withdrawal = await db.get(Withdrawal, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    if withdrawal.status != "agent_pending":
        raise HTTPException(status_code=400, detail="Withdrawal is not pending agent verification")

    # Create agent verification record
    from app.models import AgentVerification
    verification = AgentVerification(
        withdrawal_id=withdrawal_id,
        agent_id=request.agent_id,
        ghana_card_verified=request.ghana_card_verified,
        biometric_verified=request.biometric_verified,
        notes=request.notes,
        verification_photo_url=request.photo_url,
        verified_at=datetime.utcnow()
    )
    db.add(verification)

    withdrawal.agent_id = request.agent_id
    withdrawal.agent_verified_at = datetime.utcnow()
    withdrawal.status = "verified"

    await db.commit()

    return {
        "message": "Agent verification completed",
        "withdrawal_id": str(withdrawal_id),
        "agent_id": request.agent_id,
        "verified": request.ghana_card_verified and request.biometric_verified
    }


@router.post("/{withdrawal_id}/disburse")
async def disburse_withdrawal(
    withdrawal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Treasurer confirms disbursement after agent verification. Triggers MoMo send."""
    withdrawal = await db.get(Withdrawal, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    # Verify requester is the original requester
    if withdrawal.requested_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the requester can trigger disbursement")

    if withdrawal.status not in ["approved", "verified"]:
        raise HTTPException(status_code=400, detail=f"Withdrawal status is {withdrawal.status}, cannot disburse")

    group = await db.get(Group, withdrawal.group_id)

    # Call MoMo disbursement
    result = await momo_service.disburse_funds(
        phone=current_user.phone,
        amount=withdrawal.amount,
        description=f"ADANSI withdrawal from {group.name}"
    )

    if not result["success"]:
        raise HTTPException(status_code=502, detail=f"Disbursement failed: {result.get('hubtel_response')}")

    withdrawal.status = "completed"
    withdrawal.disbursed_at = datetime.utcnow()
    withdrawal.momo_disbursement_ref = result["reference"]

    # Deduct from group balance
    group.current_balance -= withdrawal.amount

    # Create audit transaction
    transaction = Transaction(
        type="withdrawal",
        reference=result["reference"],
        amount=withdrawal.amount,
        group_id=withdrawal.group_id,
        user_id=current_user.id,
        status="completed",
        external_ref=result["reference"]
    )
    db.add(transaction)

    await db.commit()

    # Notify group members
    for member in group.members:
        user = await db.get(User, member.user_id)
        if user:
            await notification_service.send_withdrawal_completed(
                phone=user.phone,
                amount=float(withdrawal.amount),
                group_name=group.name,
                agent_id=withdrawal.agent_id or "N/A"
            )

    return {
        "message": "Disbursement completed",
        "withdrawal_id": str(withdrawal_id),
        "amount": float(withdrawal.amount),
        "reference": result["reference"],
        "status": "completed"
    }
