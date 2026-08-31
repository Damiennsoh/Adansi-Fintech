"""User contribution history & audit endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import User, Contribution, GroupMember, Group, Withdrawal
from app.services.history_service import compute_user_history_metrics, compute_group_on_time_rate

router = APIRouter(prefix="/users/me/history", tags=["Contribution History"])


@router.get("")
async def get_my_contribution_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full personal contribution history across all groups."""
    result = await db.execute(
        select(Contribution, Group.name.label("group_name"))
        .join(Group, Contribution.group_id == Group.id)
        .where(Contribution.user_id == current_user.id)
        .order_by(Contribution.created_at.desc())
    )
    rows = result.all()

    withdrawals_result = await db.execute(
        select(Withdrawal, Group.name.label("group_name"))
        .join(Group, Withdrawal.group_id == Group.id)
        .where(Withdrawal.requested_by == current_user.id)
        .order_by(Withdrawal.created_at.desc())
        .limit(50)
    )
    withdrawal_rows = withdrawals_result.all()

    transactions = [
        {
            "id": str(c.id),
            "type": "contribution",
            "group_id": str(c.group_id),
            "group_name": group_name,
            "amount": float(c.amount),
            "status": c.status,
            "network": (c.meta_data or {}).get("network", "mtn"),
            "created_at": c.created_at,
        }
        for c, group_name in rows
    ] + [
        {
            "id": str(w.id),
            "type": "withdrawal",
            "group_id": str(w.group_id),
            "group_name": group_name,
            "amount": float(w.amount),
            "status": w.status,
            "network": w.beneficiary_network,
            "created_at": w.created_at,
        }
        for w, group_name in withdrawal_rows
    ]
    transactions.sort(key=lambda t: t["created_at"] or "", reverse=True)

    return {"contributions": transactions}


@router.get("/summary")
async def get_my_history_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get personal summary stats (all-time total, on-time rate %, current streak)."""
    sum_result = await db.execute(
        select(func.sum(Contribution.amount)).where(
            Contribution.user_id == current_user.id,
            Contribution.status == "completed",
        )
    )
    total_amount = sum_result.scalar() or 0.0

    groups_result = await db.execute(
        select(func.count(GroupMember.id)).where(GroupMember.user_id == current_user.id)
    )
    groups_count = groups_result.scalar() or 0

    metrics = await compute_user_history_metrics(db, current_user.id)

    return {
        "all_time_total": float(total_amount),
        "on_time_rate": metrics["on_time_rate"],
        "groups_count": groups_count,
        "current_streak_weeks": metrics["current_streak_weeks"],
        "credit_score": current_user.credit_score or 650,
    }


@router.get("/groups")
async def get_my_history_by_group(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get per-group contribution breakdown for the current user."""
    groups_result = await db.execute(
        select(Group)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .where(GroupMember.user_id == current_user.id)
    )
    groups = groups_result.scalars().all()

    breakdown = []
    for g in groups:
        user_total_result = await db.execute(
            select(func.sum(Contribution.amount)).where(
                Contribution.group_id == g.id,
                Contribution.user_id == current_user.id,
                Contribution.status == "completed",
            )
        )
        user_total = user_total_result.scalar() or 0.0

        group_total_result = await db.execute(
            select(func.sum(Contribution.amount)).where(
                Contribution.group_id == g.id,
                Contribution.status == "completed",
            )
        )
        group_total = group_total_result.scalar() or g.current_balance or 0.0

        contrib_count = await db.scalar(
            select(func.count(Contribution.id)).where(
                Contribution.group_id == g.id,
                Contribution.user_id == current_user.id,
                Contribution.status == "completed",
            )
        )

        breakdown.append({
            "group_id": str(g.id),
            "group_name": g.name,
            "user_total": float(user_total),
            "group_total": float(group_total),
            "contribution_count": contrib_count or 0,
            "on_time_rate": await compute_group_on_time_rate(db, g.id, current_user.id),
        })

    return {"groups": breakdown}
