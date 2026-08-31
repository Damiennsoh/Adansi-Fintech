"""Contribution schedule generation and history metrics."""
from datetime import datetime, date, timedelta
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Contribution, GroupMember, Group, ContributionSchedule


async def ensure_schedules_for_member(
    session: AsyncSession,
    group_id: UUID,
    user_id: UUID,
    expected_amount: Decimal,
    frequency: str,
    weeks_ahead: int = 12,
) -> None:
    """Generate upcoming contribution schedules for a group member."""
    if not frequency or frequency == "adhoc":
        return

    today = date.today()
    existing = await session.execute(
        select(func.count(ContributionSchedule.id)).where(
            ContributionSchedule.group_id == group_id,
            ContributionSchedule.user_id == user_id,
            ContributionSchedule.status == "pending",
        )
    )
    if (existing.scalar() or 0) > 0:
        return

    for i in range(1, weeks_ahead + 1):
        if frequency == "daily":
            expected_date = today + timedelta(days=i)
        elif frequency == "weekly":
            expected_date = today + timedelta(weeks=i)
        elif frequency == "monthly":
            expected_date = today + timedelta(days=30 * i)
        else:
            break

        session.add(
            ContributionSchedule(
                group_id=group_id,
                user_id=user_id,
                expected_date=expected_date,
                expected_amount=expected_amount,
                status="pending",
            )
        )


async def mark_contribution_on_schedule(
    session: AsyncSession,
    contribution: Contribution,
) -> None:
    """Link a completed contribution to the nearest pending schedule."""
    result = await session.execute(
        select(ContributionSchedule)
        .where(
            ContributionSchedule.group_id == contribution.group_id,
            ContributionSchedule.user_id == contribution.user_id,
            ContributionSchedule.status == "pending",
        )
        .order_by(ContributionSchedule.expected_date)
        .limit(1)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        return

    paid_at = contribution.created_at or datetime.utcnow()
    expected = schedule.expected_date
    paid_date = paid_at.date() if hasattr(paid_at, "date") else paid_at

    if paid_date <= expected:
        schedule.status = "paid"
    else:
        schedule.status = "late"

    schedule.paid_at = paid_at
    schedule.contribution_id = contribution.id


async def compute_user_history_metrics(session: AsyncSession, user_id: UUID) -> dict:
    """Compute on-time rate and streak from contribution schedules."""
    schedules_result = await session.execute(
        select(ContributionSchedule).where(ContributionSchedule.user_id == user_id)
    )
    schedules = schedules_result.scalars().all()

    if schedules:
        resolved = [s for s in schedules if s.status in ("paid", "late", "missed")]
        on_time = sum(1 for s in resolved if s.status == "paid")
        on_time_rate = int((on_time / len(resolved)) * 100) if resolved else 100

        streak = 0
        paid_schedules = sorted(
            [s for s in schedules if s.status == "paid" and s.paid_at],
            key=lambda s: s.paid_at,
            reverse=True,
        )
        for s in paid_schedules:
            if s.paid_at and s.paid_at.date() <= s.expected_date:
                streak += 1
            else:
                break
        current_streak_weeks = streak
    else:
        contrib_count = await session.scalar(
            select(func.count(Contribution.id)).where(
                Contribution.user_id == user_id,
                Contribution.status == "completed",
            )
        )
        on_time_rate = min(100, 70 + (contrib_count or 0) * 2)
        current_streak_weeks = min(12, contrib_count or 0)

    return {
        "on_time_rate": on_time_rate,
        "current_streak_weeks": current_streak_weeks,
    }


async def compute_group_on_time_rate(
    session: AsyncSession,
    group_id: UUID,
    user_id: UUID,
) -> int:
    """Per-group on-time rate for a user."""
    result = await session.execute(
        select(ContributionSchedule).where(
            ContributionSchedule.group_id == group_id,
            ContributionSchedule.user_id == user_id,
            ContributionSchedule.status.in_(("paid", "late", "missed")),
        )
    )
    schedules = result.scalars().all()
    if not schedules:
        count = await session.scalar(
            select(func.count(Contribution.id)).where(
                Contribution.group_id == group_id,
                Contribution.user_id == user_id,
                Contribution.status == "completed",
            )
        )
        return min(100, 80 + (count or 0))

    on_time = sum(1 for s in schedules if s.status == "paid")
    return int((on_time / len(schedules)) * 100)
