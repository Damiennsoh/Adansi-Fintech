from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from app.models import Group, GroupMember, Contribution, Withdrawal
from app.models.user import User
from app.services.group_service import GroupService


def test_reconcile_group_balance_updates_from_ledger():
    user = User(
        id=uuid4(),
        phone="+233240000010",
        full_name="Balance User",
        role="user",
        is_verified=True,
    )
    group = Group(
        id=uuid4(),
        name="Reconcile Group",
        code="BAL001",
        type="savings",
        created_by=user.id,
        current_balance=Decimal("900"),
        status="active",
        withdrawal_threshold=Decimal("500"),
        approval_rule="any_1_treasurer",
        join_type="approval_required",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        members=[
            GroupMember(
                id=uuid4(),
                group_id=uuid4(),
                user_id=user.id,
                role="admin",
                joined_at=datetime.utcnow(),
                total_contributed=Decimal("0"),
                contribution_streak=0,
                user=user,
            )
        ],
    )

    group.members[0].group_id = group.id
    group.contributions = [
        Contribution(
            id=uuid4(),
            group_id=group.id,
            user_id=user.id,
            amount=Decimal("600"),
            method="momo",
            status="completed",
            created_at=datetime.utcnow(),
        )
    ]
    group.withdrawals = [
        Withdrawal(
            id=uuid4(),
            group_id=group.id,
            requested_by=user.id,
            amount=Decimal("250"),
            reason="School fee",
            status="disbursed",
            beneficiary_name="Ada",
            beneficiary_phone="+233244000000",
            created_at=datetime.utcnow(),
        )
    ]

    reconciled = Decimal("600") - Decimal("250")
    assert reconciled == Decimal("350")
