"""Group management service."""
import random
import string
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models import Group, GroupMember, User, Contribution, Withdrawal


class GroupService:
    """Business logic for groups, members, and codes."""

    @staticmethod
    def generate_group_code() -> str:
        """Generate a unique 6-character alphanumeric group code."""
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    @staticmethod
    async def create_group(
        name: str,
        type: str,
        created_by: UUID,
        purpose: Optional[str] = None,
        target_amount: Optional[float] = None,
        withdrawal_threshold: float = 500.0,
        agent_verification_required: bool = False,
        contribution_frequency: Optional[str] = None,
        contribution_amount: Optional[float] = None,
        approval_rule: str = "any_1_treasurer",
        approval_timeout_hours: int = 24,
        auto_approve_limit: float = 0,
        join_type: str = "approval_required",
        rotation_enabled: bool = False,
        rotation_queue: Optional[list] = None,
    ) -> Group:
        """Create a new group with auto-generated code."""
        async with AsyncSessionLocal() as session:
            # Ensure unique code
            code = GroupService.generate_group_code()
            while await session.scalar(select(Group).where(Group.code == code)):
                code = GroupService.generate_group_code()

            group = Group(
                name=name,
                code=code,
                type=type,
                purpose=purpose,
                target_amount=target_amount,
                created_by=created_by,
                withdrawal_threshold=withdrawal_threshold,
                agent_verification_required=agent_verification_required,
                contribution_frequency=contribution_frequency,
                contribution_amount=contribution_amount,
                approval_rule=approval_rule,
                approval_timeout_hours=approval_timeout_hours,
                auto_approve_limit=auto_approve_limit,
                join_type=join_type,
                rotation_enabled=rotation_enabled,
                rotation_queue=rotation_queue or [],
            )
            session.add(group)
            await session.flush()

            # Creator is admin (treasury signatory #1)
            member = GroupMember(
                group_id=group.id,
                user_id=created_by,
                role="admin"
            )
            session.add(member)
            await session.commit()
            await session.refresh(group)
            return group

    @staticmethod
    async def get_group_by_code(code: str) -> Optional[Group]:
        """Find group by short code, tolerating mixed case or whitespace."""
        normalized = (code or '').strip().upper()
        if not normalized:
            return None

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Group).where(func.upper(Group.code) == normalized)
            )
            group = result.scalar_one_or_none()
            if group:
                return group

            result = await session.execute(
                select(Group)
                .where(func.upper(Group.code).like(f"%{normalized}%"))
                .order_by(Group.name.asc())
                .limit(1)
            )
            return result.scalar_one_or_none()

    @staticmethod
    async def search_groups(query: str) -> List[Group]:
        """Search groups by name or code. Supports diaspora discovery without code-only lookup."""
        if not query or not query.strip():
            return []

        normalized = query.strip()
        async with AsyncSessionLocal() as session:
            stmt = select(Group).options(selectinload(Group.members)).where(
                (Group.name.ilike(f"%{normalized}%")) |
                (Group.code.ilike(f"%{normalized}%"))
            ).order_by(Group.name.asc())
            result = await session.execute(stmt)
            return result.scalars().all()

    @staticmethod
    async def get_user_groups(user_id: UUID) -> List[Group]:
        """Get all groups a user belongs to."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Group)
                .join(GroupMember)
                .where(GroupMember.user_id == user_id)
                .options(selectinload(Group.members))
            )
            return result.scalars().all()

    @staticmethod
    async def join_group(group_id: UUID, user_id: UUID) -> GroupMember:
        """Add a user to a group."""
        async with AsyncSessionLocal() as session:
            # Check if already member
            existing = await session.scalar(
                select(GroupMember).where(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == user_id
                )
            )
            if existing:
                return existing

            member = GroupMember(group_id=group_id, user_id=user_id, role="member")
            session.add(member)

            group = await session.get(Group, group_id)
            if group and group.rotation_enabled:
                queue = list(group.rotation_queue or [])
                queue.append({"user_id": str(user_id), "position": len(queue) + 1})
                group.rotation_queue = queue

            # Increment user's group count
            user = await session.get(User, user_id)
            if user:
                user.groups_count += 1

            await session.commit()
            await session.refresh(member)
            return member

    @staticmethod
    async def reconcile_group_balance(session: AsyncSession, group_id: UUID) -> Decimal:
        """Recalculate group current_balance from completed contributions and disbursed withdrawals."""
        group = await session.get(Group, group_id)
        if not group:
            raise ValueError("Group not found")

        contributions_total = await session.scalar(
            select(func.coalesce(func.sum(Contribution.amount), 0)).where(
                Contribution.group_id == group_id,
                Contribution.status == "completed",
            )
        )
        withdrawals_total = await session.scalar(
            select(func.coalesce(func.sum(Withdrawal.amount), 0)).where(
                Withdrawal.group_id == group_id,
                Withdrawal.status == "disbursed",
            )
        )

        balance = (Decimal(str(contributions_total or 0)) - Decimal(str(withdrawals_total or 0)))
        group.current_balance = balance
        await session.flush()
        return balance


group_service = GroupService()
