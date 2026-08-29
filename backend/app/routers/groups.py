"""Group management endpoints with full CRUD."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.group_service import group_service
from app.services.notification_service import notification_service
from app.schemas.group import (
    GroupCreateRequest, GroupResponse, GroupListResponse,
    JoinGroupRequest, InviteMemberRequest
)
from app.models import Group, GroupMember, User, Contribution

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
        purpose=request.purpose,
        target_amount=request.target_amount,
        withdrawal_threshold=request.withdrawal_threshold,
        agent_verification_required=request.agent_verification_required,
        contribution_frequency=request.contribution_frequency,
        contribution_amount=request.contribution_amount,
        created_by=current_user.id
    )
    return group


@router.get("", response_model=List[GroupListResponse])
async def list_my_groups(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all groups the current user belongs to."""
    result = await db.execute(
        select(Group, GroupMember.role)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .where(GroupMember.user_id == current_user.id)
        .options(selectinload(Group.members))
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


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get group details, members, and recent activity."""
    # Verify user is member
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return group


@router.get("/code/{code}")
async def get_group_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """Lookup group by short code (for USSD joining)."""
    group = await group_service.get_group_by_code(code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"id": group.id, "name": group.name, "code": group.code, "type": group.type}


@router.post("/{group_id}/join")
async def join_group(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Join a group by ID."""
    member = await group_service.join_group(group_id, current_user.id)
    return {"message": "Joined successfully", "member_id": str(member.id)}


@router.post("/join-by-code")
async def join_group_by_code(request: JoinGroupRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Join a group by short code."""
    group = await group_service.get_group_by_code(request.code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    member = await group_service.join_group(group.id, current_user.id)
    return {"message": f"Joined {group.name} successfully", "group_id": str(group.id)}


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

    member.role = role
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

    await db.delete(member)
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

    # Get member's personal contribution
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
        "balance": float(group.current_balance),
        "my_contribution": float(my_contribution),
        "target_amount": float(group.target_amount) if group.target_amount else None,
        "member_count": len(group.members)
    }


@router.get("/{group_id}/contributions")
async def get_group_contributions(
    group_id: UUID,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Paginated list of group contributions."""
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
