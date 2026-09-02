"""Credit scoring engine: rule-based MVP."""
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import User, Contribution, GroupMember, CreditProfile, Loan, Group
from app.services.redis_service import redis_service


class CreditScoringEngine:
    """Rule-based credit scoring for ADANSI users."""

    # Score weights (must sum to 1000)
    WEIGHT_CONSISTENCY = 350
    WEIGHT_VOLUME = 250
    WEIGHT_DIVERSITY = 150
    WEIGHT_TENURE = 100
    WEIGHT_STANDING = 100
    WEIGHT_BEHAVIOR = 50

    @classmethod
    async def calculate_score(cls, user_id: UUID) -> dict:
        """Calculate credit score for a user. Returns full score breakdown."""
        # Check cache first
        cached = redis_service.get_cached_credit_score(str(user_id))
        if cached:
            return cached

        async with AsyncSessionLocal() as session:
            user = await session.get(User, user_id)
            if not user:
                return {"score": 0, "eligible": False}

            # 1. Payment Consistency (35% = 350 points)
            consistency_score = await cls._calculate_consistency(session, user_id)

            # 2. Contribution Volume (25% = 250 points)
            volume_score = await cls._calculate_volume(session, user_id)

            # 3. Group Diversity (15% = 150 points)
            diversity_score = await cls._calculate_diversity(session, user_id)

            # 4. Tenure (10% = 100 points)
            tenure_score = await cls._calculate_tenure(user)

            # 5. Group Standing (10% = 100 points)
            standing_score = await cls._calculate_standing(session, user_id)

            # 6. Withdrawal Behavior (5% = 50 points)
            behavior_score = await cls._calculate_behavior(session, user_id)

            total_score = (
                consistency_score + volume_score + diversity_score +
                tenure_score + standing_score + behavior_score
            )

            # Clamp to 0-1000
            total_score = max(0, min(1000, total_score))

            # Determine eligibility and max loan
            eligible, max_loan, tier = cls._get_loan_terms(total_score)

            result = {
                "user_id": str(user_id),
                "score": total_score,
                "tier": tier,
                "loan_eligible": eligible,
                "max_loan_amount": max_loan,
                "breakdown": {
                    "consistency": {"points": consistency_score, "max_points": cls.WEIGHT_CONSISTENCY},
                    "volume": {"points": volume_score, "max_points": cls.WEIGHT_VOLUME},
                    "diversity": {"points": diversity_score, "max_points": cls.WEIGHT_DIVERSITY},
                    "tenure": {"points": tenure_score, "max_points": cls.WEIGHT_TENURE},
                    "standing": {"points": standing_score, "max_points": cls.WEIGHT_STANDING},
                    "behavior": {"points": behavior_score, "max_points": cls.WEIGHT_BEHAVIOR}
                },
                "calculated_at": datetime.utcnow().isoformat()
            }

            # Cache result
            redis_service.cache_credit_score(str(user_id), result)

            # Update or create credit profile in DB
            await cls._update_credit_profile(session, user_id, total_score, result)

            return result

    @classmethod
    async def _calculate_consistency(cls, session: AsyncSession, user_id: UUID) -> int:
        """Consistency = ratio of on-time contributions to expected contributions."""
        # Get all group memberships
        result = await session.execute(
            select(GroupMember).where(GroupMember.user_id == user_id)
        )
        memberships = result.scalars().all()

        if not memberships:
            return 0

        total_expected = 0
        total_actual = 0

        for member in memberships:
            group = await session.get(Group, member.group_id)
            if not group or group.status != "active":
                continue

            # Calculate expected contributions based on frequency and tenure
            days_since_join = (datetime.utcnow() - member.joined_at).days

            if group.contribution_frequency == "daily":
                expected = days_since_join
            elif group.contribution_frequency == "weekly":
                expected = days_since_join // 7
            elif group.contribution_frequency == "monthly":
                expected = days_since_join // 30
            else:
                expected = 1  # adhoc: at least 1 expected

            expected = max(expected, 1)
            total_expected += expected

            # Count actual contributions
            contrib_result = await session.execute(
                select(func.count(Contribution.id)).where(
                    Contribution.user_id == user_id,
                    Contribution.group_id == group.id,
                    Contribution.status == "completed"
                )
            )
            actual = contrib_result.scalar() or 0
            total_actual += actual

        if total_expected == 0:
            return 0

        ratio = min(total_actual / total_expected, 1.0)
        return int(ratio * cls.WEIGHT_CONSISTENCY)

    @classmethod
    async def _calculate_volume(cls, session: AsyncSession, user_id: UUID) -> int:
        """Volume = total lifetime contribution amount."""
        result = await session.execute(
            select(func.sum(Contribution.amount)).where(
                Contribution.user_id == user_id,
                Contribution.status == "completed"
            )
        )
        total = result.scalar() or Decimal("0")

        # Scale: GHS 10,000 = full points, linear below
        max_volume = Decimal("10000")
        ratio = min(float(total) / float(max_volume), 1.0)
        return int(ratio * cls.WEIGHT_VOLUME)

    @classmethod
    async def _calculate_diversity(cls, session: AsyncSession, user_id: UUID) -> int:
        """Diversity = number of different group types participated in."""
        result = await session.execute(
            select(Group.type)
            .join(GroupMember)
            .where(GroupMember.user_id == user_id)
            .distinct()
        )
        types = result.scalars().all()

        # Max 6 types (funeral, wedding, susu, school, health, investment)
        ratio = min(len(types) / 6, 1.0)
        return int(ratio * cls.WEIGHT_DIVERSITY)

    @classmethod
    def _calculate_tenure(cls, user: User) -> int:
        """Tenure = months since first contribution on platform."""
        days = (datetime.utcnow() - user.created_at).days
        months = days / 30

        # Max 12 months = full points
        ratio = min(months / 12, 1.0)
        return int(ratio * cls.WEIGHT_TENURE)

    @classmethod
    async def _calculate_standing(cls, session: AsyncSession, user_id: UUID) -> int:
        """Standing = admin/treasurer roles get bonus."""
        result = await session.execute(
            select(GroupMember.role, func.count(GroupMember.id))
            .where(GroupMember.user_id == user_id)
            .group_by(GroupMember.role)
        )
        roles = dict(result.all())

        score = 0
        score += roles.get("admin", 0) * 30
        score += roles.get("treasurer", 0) * 20
        score += roles.get("member", 0) * 5

        return min(score, cls.WEIGHT_STANDING)

    @classmethod
    async def _calculate_behavior(cls, session: AsyncSession, user_id: UUID) -> int:
        """Behavior = no failed withdrawals or disputes = full points."""
        # For MVP: assume good behavior unless proven otherwise
        # In production: check for rejected withdrawals, loan defaults
        result = await session.execute(
            select(func.count(Loan.id)).where(
                Loan.user_id == user_id,
                Loan.status == "defaulted"
            )
        )
        defaults = result.scalar() or 0

        if defaults > 0:
            penalty = min(defaults * 25, cls.WEIGHT_BEHAVIOR)
            return cls.WEIGHT_BEHAVIOR - penalty
        return cls.WEIGHT_BEHAVIOR

    @classmethod
    def _get_loan_terms(cls, score: int) -> tuple:
        """Map score to loan eligibility, max amount, and tier."""
        if score < 300:
            return False, 0, "no_credit"
        elif score < 500:
            return True, 100, "bronze"
        elif score < 650:
            return True, 300, "silver"
        elif score < 800:
            return True, 600, "gold"
        else:
            return True, 1000, "platinum"

    @classmethod
    async def _update_credit_profile(cls, session: AsyncSession, user_id: UUID, score: int, data: dict) -> None:
        """Update or create credit profile in database."""
        result = await session.execute(
            select(CreditProfile).where(CreditProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()

        if not profile:
            profile = CreditProfile(user_id=user_id)
            session.add(profile)

        profile.score = score
        profile.loan_eligible = data["loan_eligible"]
        profile.max_loan_amount = Decimal(str(data["max_loan_amount"]))
        profile.last_calculated_at = datetime.utcnow()

        await session.commit()


credit_engine = CreditScoringEngine()
