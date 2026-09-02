"""Group management endpoints with full CRUD."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List
from datetime import datetime

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.group_service import group_service
from app.services.notification_service import notification_service
from app.schemas.group import (
    GroupCreateRequest, GroupResponse, GroupListResponse,
    JoinGroupRequest, InviteMemberRequest
)
from app.models import Group, GroupMember, User, Contribution, AuditEvent, JoinRequest

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    request: GroupCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new group. Auto-generates short code."""
    group = await group_service.create_group(
        name=request.name,
        type=request.type,
        purpose=request.get_purpose(),
        target_amount=request.target_amount,
        withdrawal_threshold=request.withdrawal_threshold,
        agent_verification_required=request.agent_verification_required,
        contribution_frequency=request.get_frequency(),
        contribution_amount=request.contribution_amount,
        created_by=current_user.id,
        approval_rule=request.approval_rule,
        approval_timeout_hours=request.approval_timeout_hours,
        auto_approve_limit=float(request.auto_approve_limit or 0),
        join_type=request.join_type or "approval_required",
        rotation_enabled=request.rotation_enabled,
        rotation_queue=request.rotation_queue,
    )
    return group


@router.get("", response_model=List[GroupListResponse])
async def list_my_groups(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all groups the current user belongs to."""
    result = await db.execute(
        select(Group, GroupMember.role)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .where(GroupMember.user_id == current_user.id)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
    )
    rows = result.all()

    return [
        {
            "id": group.id,
            "name": group.name,
            "code": group.code,
            "type": group.type,
            "current_balance": group.current_balance,
            "my_role": role,
            "member_count": len(group.members)
        }
        for group, role in rows
    ]


@router.get("/search")
async def search_groups(query: str, db: AsyncSession = Depends(get_db)):
    """Search groups by code or name for diaspora discovery flows."""
    if not query or not query.strip():
        return []

    groups = await group_service.search_groups(query)
    return [
        {
            "id": group.id,
            "name": group.name,
            "code": group.code,
            "type": group.type,
            "current_balance": float(group.current_balance or 0),
            "members": len(group.members),
            "balance": float(group.current_balance or 0),
            "member_count": len(group.members),
        }
        for group in groups
    ]


@router.get("/code/{code}")
async def get_group_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """Lookup group by short code (for USSD joining)."""
    group = await group_service.get_group_by_code(code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    member_count = len(group.members)
    return {
        "id": group.id,
        "name": group.name,
        "code": group.code,
        "type": group.type,
        "current_balance": float(group.current_balance or 0),
        "members": member_count,
        "balance": float(group.current_balance or 0),
        "member_count": member_count,
    }


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get group details, members, and recent activity."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
        .where(Group.id == group_id)
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return group


@router.post("/{group_id}/join")
async def join_group(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create a join request; admins approve membership."""
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    existing = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    if existing.scalar_one_or_none():
        return {"message": "Already a member", "status": "approved"}
    pending = await db.scalar(select(JoinRequest).where(JoinRequest.group_id == group_id, JoinRequest.user_id == current_user.id, JoinRequest.status == "pending"))
    if pending:
        return {"message": "Join request already pending", "request_id": str(pending.id), "status": "pending"}

    request = JoinRequest(group_id=group_id, user_id=current_user.id)
    db.add(request)
    await db.flush()
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="join_requested", entity_type="join_request", entity_id=request.id))
    await db.commit()
    return {"message": "Join request submitted", "request_id": str(request.id), "status": "pending"} 

@router.get("/{group_id}/audit")
async def get_group_audit(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    member = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    if not member.scalar_one_or_none(): raise HTTPException(status_code=403, detail="Not a member")
    result = await db.execute(select(AuditEvent).where(AuditEvent.group_id == group_id).order_by(AuditEvent.created_at.desc()).limit(100))
    return {"events": [{"id": str(e.id), "event_type": e.event_type, "entity_type": e.entity_type, "entity_id": str(e.entity_id) if e.entity_id else None, "amount": float(e.amount) if e.amount is not None else None, "metadata": e.event_metadata, "created_at": e.created_at} for e in result.scalars().all()]}

@router.get("/{group_id}/join-requests")
async def get_join_requests(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    admin = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id, GroupMember.role.in_(["admin", "treasurer"])))
    if not admin.scalar_one_or_none(): raise HTTPException(status_code=403, detail="Only group admins can review requests")
    result = await db.execute(select(JoinRequest).where(JoinRequest.group_id == group_id, JoinRequest.status == "pending"))
    return {"requests": [{"id": str(r.id), "user_id": str(r.user_id), "status": r.status, "created_at": r.requested_at} for r in result.scalars().all()]}

@router.post("/{group_id}/join-requests/{request_id}/review")
async def review_join_request(group_id: UUID, request_id: UUID, approved: bool, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    admin = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id, GroupMember.role == "admin"))
    if not admin.scalar_one_or_none(): raise HTTPException(status_code=403, detail="Only admins can review requests")
    result = await db.execute(select(JoinRequest).where(JoinRequest.id == request_id, JoinRequest.group_id == group_id))
    request = result.scalar_one_or_none()
    if not request or request.status != "pending": raise HTTPException(status_code=404, detail="Pending request not found")
    request.status = "approved" if approved else "rejected"; request.responded_by = current_user.id; request.responded_at = datetime.utcnow()
    if approved:
        db.add(GroupMember(group_id=group_id, user_id=request.user_id, role="member"))
        group = await db.get(Group, group_id)
        if group and group.rotation_enabled:
            queue = list(group.rotation_queue or [])
            queue.append({"user_id": str(request.user_id), "position": len(queue) + 1})
            group.rotation_queue = queue
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="join_approved" if approved else "join_rejected", entity_type="join_request", entity_id=request.id))
    await db.commit()
    return {"status": request.status}


@router.post("/join-by-code")
async def join_group_by_code(request: JoinGroupRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Join a group by short code — respects join_type approval rules."""
    group = await group_service.get_group_by_code(request.code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    existing = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.user_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        return {"message": f"Already a member of {group.name}", "group_id": str(group.id), "status": "approved"}

    join_type = getattr(group, "join_type", "approval_required") or "approval_required"

    if join_type == "open":
        member = await group_service.join_group(group.id, current_user.id)
        return {"message": f"Joined {group.name} successfully", "group_id": str(group.id), "status": "approved"}

    if join_type == "invite_only":
        raise HTTPException(status_code=403, detail="This group is invite-only")

    jr = await db.scalar(select(JoinRequest).where(JoinRequest.group_id == group.id, JoinRequest.user_id == current_user.id, JoinRequest.status == "pending"))
    if jr:
        return {"message": "Join request already pending", "group_id": str(group.id), "status": "pending", "request_id": str(jr.id)}
    jr = JoinRequest(group_id=group.id, user_id=current_user.id)
    db.add(jr)
    await db.flush()
    db.add(AuditEvent(group_id=group.id, actor_id=current_user.id, event_type="join_requested", entity_type="join_request", entity_id=jr.id))
    await db.commit()
    return {"message": "Join request submitted", "group_id": str(group.id), "status": "pending", "request_id": str(jr.id)}


@router.post("/{group_id}/invite")
async def invite_member(
    group_id: UUID,
    request: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite a member via WhatsApp or SMS."""
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if request.phone:
        await notification_service.send_group_invite(
            phone=request.phone,
            inviter_name=current_user.full_name,
            group_name=group.name,
            group_code=group.code
        )

    return {"message": "Invite sent", "channel": request.channel, "group": group.name}


@router.post("/{group_id}/members/{user_id}/role")
async def update_member_role(
    group_id: UUID,
    user_id: UUID,
    role: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update member role (admin only)."""
    # Verify current user is admin
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == "admin"
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can change roles")

    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    )
    member = member.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if role not in {"admin", "treasurer", "member"}:
        raise HTTPException(status_code=400, detail="Role must be admin, treasurer, or member")

    if member.role == "admin" and role != "admin":
        admin_count = await db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id, GroupMember.role == "admin"))
        if (admin_count or 0) <= 1:
            raise HTTPException(status_code=400, detail="A group must always have at least one admin")

    member.role = role
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="member_role_updated", entity_type="group_member", entity_id=member.id, event_metadata={"target_user_id": str(user_id), "role": role}))
    await db.commit()
    return {"message": "Role updated", "user_id": str(user_id), "new_role": role}


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove member from group (admin only)."""
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == "admin"
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can remove members")

    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    )
    member = member.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.role == "admin":
        admin_count = await db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id, GroupMember.role == "admin"))
        if (admin_count or 0) <= 1:
            raise HTTPException(status_code=400, detail="A group must always have at least one admin")

    await db.delete(member)
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="member_removed", entity_type="group_member", entity_id=member.id, event_metadata={"target_user_id": str(user_id)}))
    await db.commit()
    return {"message": "Member removed", "user_id": str(user_id)}


@router.get("/{group_id}/balance")
async def get_group_balance(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get real-time group balance."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Keep the balance source-of-truth aligned with the contribution/withdrawal ledger.
    try:
        current_balance = await group_service.reconcile_group_balance(db, group_id)
    except ValueError:
        current_balance = group.current_balance

    member_result = await db.execute(
        select(func.sum(Contribution.amount)).where(
            Contribution.group_id == group_id,
            Contribution.user_id == current_user.id,
            Contribution.status == "completed"
        )
    )
    my_contribution = member_result.scalar() or 0

    return {
        "group_id": str(group_id),
        "group_name": group.name,
        "balance": float(current_balance),
        "my_contribution": float(my_contribution),
        "target_amount": float(group.target_amount) if group.target_amount else None,
        "member_count": len(group.members)
    }


@router.post("/{group_id}/reconcile")
async def reconcile_group_balance(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Recalculate the group balance from the ledger and store the result."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    try:
        balance = await group_service.reconcile_group_balance(db, group_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Group not found")

    await db.commit()
    return {"group_id": str(group_id), "balance": float(balance)}


@router.get("/{group_id}/contributions")
async def get_group_contributions(
    group_id: UUID,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Paginated list of group contributions."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    result = await db.execute(
        select(Contribution)
        .where(Contribution.group_id == group_id)
        .order_by(Contribution.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    contributions = result.scalars().all()
    return {"contributions": contributions, "count": len(contributions)}


@router.get("/{group_id}/withdrawals")
async def get_group_withdrawals(
    group_id: UUID,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Paginated list of group withdrawals."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    from app.models import Withdrawal
    result = await db.execute(
        select(Withdrawal)
        .where(Withdrawal.group_id == group_id)
        .order_by(Withdrawal.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    withdrawals = result.scalars().all()
    return {"withdrawals": withdrawals, "count": len(withdrawals)}
