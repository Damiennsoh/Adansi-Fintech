"""Group management service."""
import random
import string
from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models import Group, GroupMember, User


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
        purpose: Optional[str],
        target_amount: Optional[float],
        withdrawal_threshold: float,
        agent_verification_required: bool,
        contribution_frequency: Optional[str],
        contribution_amount: Optional[float],
        created_by: UUID,
        approval_rule: str = "any_1_treasurer",
        approval_timeout_hours: int = 24
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
                approval_timeout_hours=approval_timeout_hours
            )
            session.add(group)
            await session.flush()  # Get group.id

            # Creator is automatically admin
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
        """Find group by short code."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Group).where(Group.code == code.upper())
            )
            return result.scalar_one_or_none()

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

            # Increment user's group count
            user = await session.get(User, user_id)
            if user:
                user.groups_count += 1

            await session.commit()
            await session.refresh(member)
            return member


group_service = GroupService()
