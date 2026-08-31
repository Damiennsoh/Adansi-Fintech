"""Withdrawal endpoints with full approval workflow."""
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.notification_service import notification_service
from app.services.withdrawal_service import (
    calculate_required_approvals,
    execute_disbursement,
    validate_ghana_phone,
    withdrawal_expires_at,
)
from app.schemas.withdrawal import (
    WithdrawalCreateRequest, WithdrawalApprovalRequest,
    AgentVerifyRequest,
)
from app.models import Withdrawal, WithdrawalApproval, Group, GroupMember, User

router = APIRouter(prefix="/withdrawals", tags=["Withdrawals"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def request_withdrawal(
    request: WithdrawalCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Request withdrawal from group. Triggers approval workflow or auto-disburse."""
    role_check = await db.execute(
        select(GroupMember.role).where(
            GroupMember.group_id == request.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    role = role_check.scalar_one_or_none()
    if role not in ["admin", "treasurer", "creator"]:
        raise HTTPException(status_code=403, detail="Only treasurers can request withdrawals")

    group = await db.get(Group, request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.current_balance < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient group balance")

    beneficiary_phone = request.beneficiary_phone
    if beneficiary_phone and request.disbursement_method != "bank_transfer":
        if not validate_ghana_phone(beneficiary_phone):
            raise HTTPException(status_code=400, detail="Invalid beneficiary phone number")

    if not request.beneficiary_name or not beneficiary_phone:
        raise HTTPException(
            status_code=400,
            detail="Beneficiary name and phone are required for direct disbursement"
        )

    auto_limit = float(group.auto_approve_limit or 0)
    if auto_limit > 0 and float(request.amount) <= auto_limit:
        withdrawal = Withdrawal(
            group_id=request.group_id,
            requested_by=current_user.id,
            amount=request.amount,
            reason=request.reason,
            beneficiary_name=request.beneficiary_name,
            beneficiary_phone=beneficiary_phone,
            beneficiary_network=request.beneficiary_network or "mtn",
            disbursement_method=request.disbursement_method or "momo",
            beneficiary_bank_account=request.beneficiary_bank_account,
            status="approved",
            approval_required=0,
            approval_count=0,
            approved_at=datetime.utcnow(),
        )
        db.add(withdrawal)
        await db.flush()

        result = await execute_disbursement(withdrawal, group, current_user.id, db)
        if not result["success"]:
            raise HTTPException(status_code=502, detail=result.get("error", "Auto-disbursement failed"))

        return {
            "message": "Withdrawal auto-approved and disbursed",
            "withdrawal_id": str(withdrawal.id),
            "amount": float(request.amount),
            "status": "disbursed",
            "method": "auto_approved",
            "beneficiary": request.beneficiary_name,
            "transaction_ref": result.get("reference"),
        }

    required_approvals = calculate_required_approvals(group)
    needs_agent = group.agent_verification_required and request.amount >= group.withdrawal_threshold

    withdrawal = Withdrawal(
        group_id=request.group_id,
        requested_by=current_user.id,
        amount=request.amount,
        reason=request.reason,
        beneficiary_name=request.beneficiary_name,
        beneficiary_phone=beneficiary_phone,
        beneficiary_network=request.beneficiary_network or "mtn",
        disbursement_method=request.disbursement_method or "momo",
        beneficiary_bank_account=request.beneficiary_bank_account,
        status="pending",
        approval_required=required_approvals,
        expires_at=withdrawal_expires_at(group),
    )
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)

    for member in group.members:
        if member.user_id != current_user.id and member.role in ("admin", "treasurer", "creator"):
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
        "status": "pending",
        "beneficiary": request.beneficiary_name,
    }


@router.get("/{withdrawal_id}")
async def get_withdrawal(withdrawal_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get withdrawal status and approvals received."""
    withdrawal = await db.get(Withdrawal, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == withdrawal.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    approvals_result = await db.execute(
        select(WithdrawalApproval).where(WithdrawalApproval.withdrawal_id == withdrawal_id)
    )
    approvals = approvals_result.scalars().all()

    return {
        "withdrawal_id": str(withdrawal.id),
        "group_id": str(withdrawal.group_id),
        "amount": float(withdrawal.amount),
        "reason": withdrawal.reason,
        "beneficiary_name": withdrawal.beneficiary_name,
        "beneficiary_phone": withdrawal.beneficiary_phone,
        "beneficiary_network": withdrawal.beneficiary_network,
        "status": withdrawal.status,
        "approval_count": withdrawal.approval_count,
        "approval_required": withdrawal.approval_required,
        "approvals": [
            {"member_id": str(a.member_id), "approved": a.approved, "channel": a.channel}
            for a in approvals
        ],
        "agent_verified": withdrawal.agent_verified_at is not None,
        "created_at": withdrawal.created_at,
        "expires_at": withdrawal.expires_at,
    }


@router.get("/group/{group_id}/pending")
async def get_pending_withdrawals(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pending withdrawals for a group."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Withdrawal).where(
            Withdrawal.group_id == group_id,
            Withdrawal.status == "pending"
        ).order_by(Withdrawal.created_at.desc())
    )
    withdrawals = result.scalars().all()

    items = []
    for w in withdrawals:
        requester = await db.get(User, w.requested_by)
        items.append({
            "id": str(w.id),
            "amount": float(w.amount),
            "reason": w.reason,
            "beneficiary_name": w.beneficiary_name,
            "beneficiary_phone": w.beneficiary_phone,
            "requester_name": requester.full_name if requester else "Unknown",
            "approval_count": w.approval_count,
            "approval_required": w.approval_required,
            "created_at": w.created_at,
        })

    return {"withdrawals": items}


@router.post("/{withdrawal_id}/approve")
async def approve_withdrawal(
    withdrawal_id: UUID,
    request: WithdrawalApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Treasurer approves or rejects a pending withdrawal."""
    withdrawal = await db.scalar(select(Withdrawal).where(Withdrawal.id == withdrawal_id).with_for_update())
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    if withdrawal.status != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal.status}")

    if withdrawal.expires_at and datetime.utcnow() > withdrawal.expires_at.replace(tzinfo=None):
        withdrawal.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Withdrawal request has expired")

    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == withdrawal.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    member = member_check.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    if current_user.id == withdrawal.requested_by:
        raise HTTPException(status_code=403, detail="The requester cannot approve their own withdrawal")

    group = await db.get(Group, withdrawal.group_id)
    rule = group.approval_rule or "any_1_treasurer"
    if rule in ("any_1_treasurer", "two_of_three_treasurers"):
        if member.role not in ("admin", "treasurer", "creator"):
            raise HTTPException(status_code=403, detail="Only treasurers can approve this withdrawal")
    elif member.role not in ("admin", "treasurer", "creator", "member"):
        raise HTTPException(status_code=403, detail="You cannot approve this withdrawal")

    existing = await db.execute(
        select(WithdrawalApproval).where(
            WithdrawalApproval.withdrawal_id == withdrawal_id,
            WithdrawalApproval.member_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already voted on this withdrawal")

    if not request.approved:
        withdrawal.status = "rejected"
        db.add(WithdrawalApproval(
            withdrawal_id=withdrawal_id,
            member_id=current_user.id,
            approved=False,
            channel="pwa"
        ))
        await db.commit()
        return {
            "message": "Withdrawal rejected",
            "approved": False,
            "status": "rejected",
        }

    db.add(WithdrawalApproval(
        withdrawal_id=withdrawal_id,
        member_id=current_user.id,
        approved=True,
        channel="pwa"
    ))
    withdrawal.approval_count += 1
    await db.flush()

    disbursed = False
    disburse_ref = None

    if withdrawal.approval_count >= withdrawal.approval_required:
        if group.agent_verification_required and withdrawal.amount >= group.withdrawal_threshold:
            withdrawal.status = "agent_pending"
            await db.commit()
        else:
            withdrawal.status = "approved"
            withdrawal.approved_at = datetime.utcnow()
            await db.flush()
            result = await execute_disbursement(withdrawal, group, current_user.id, db)
            disbursed = result.get("success", False)
            disburse_ref = result.get("reference")
            if not disbursed:
                raise HTTPException(status_code=502, detail=result.get("error", "Disbursement failed"))
    else:
        await db.commit()

    return {
        "message": "Approval recorded",
        "approved": True,
        "approvals_received": withdrawal.approval_count,
        "approvals_required": withdrawal.approval_required,
        "status": withdrawal.status,
        "disbursed": disbursed,
        "transaction_ref": disburse_ref,
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
    """Trigger disbursement after agent verification (funds go to beneficiary)."""
    withdrawal = await db.get(Withdrawal, withdrawal_id)
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == withdrawal.group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role.in_(["admin", "treasurer", "creator"])
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only treasurers can trigger disbursement")

    if withdrawal.status not in ["approved", "verified"]:
        raise HTTPException(status_code=400, detail=f"Withdrawal status is {withdrawal.status}, cannot disburse")

    group = await db.get(Group, withdrawal.group_id)
    result = await execute_disbursement(withdrawal, group, current_user.id, db)

    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Disbursement failed"))

    return {
        "message": "Disbursement completed",
        "withdrawal_id": str(withdrawal_id),
        "amount": float(withdrawal.amount),
        "reference": result["reference"],
        "beneficiary": result.get("beneficiary"),
        "status": "disbursed",
    }
