from decimal import Decimal
from uuid import uuid4

from app.models import Group, GroupMember, User
from app.services.withdrawal_service import (
    calculate_required_approvals,
    validate_ghana_phone,
    detect_network,
)


def test_calculate_required_approvals():
    user1 = User(id=uuid4(), phone="+233240000001", full_name="Admin")
    user2 = User(id=uuid4(), phone="+233240000002", full_name="Treasurer")
    user3 = User(id=uuid4(), phone="+233240000003", full_name="Member")

    group = Group(
        id=uuid4(),
        name="Test Approval",
        code="APP001",
        type="funeral",
        created_by=user1.id,
        current_balance=Decimal("1000"),
        approval_rule="two_of_three_treasurers",
        members=[
            GroupMember(id=uuid4(), user_id=user1.id, role="admin"),
            GroupMember(id=uuid4(), user_id=user2.id, role="treasurer"),
            GroupMember(id=uuid4(), user_id=user3.id, role="member"),
        ],
    )

    assert calculate_required_approvals(group) == 2

    # If rule is majority_members
    group.approval_rule = "majority_members"
    assert calculate_required_approvals(group) == 2

    # If rule is unanimous
    group.approval_rule = "unanimous_members"
    assert calculate_required_approvals(group) == 3

    # If rule is any_1_treasurer
    group.approval_rule = "any_1_treasurer"
    assert calculate_required_approvals(group) == 1

    # Safe fallback when members attribute is None/detached
    bare_group = Group(id=uuid4(), name="Bare", code="BAR001", type="savings", created_by=user1.id)
    assert calculate_required_approvals(bare_group) == 1


def test_ghana_phone_validation_and_network_detection():
    assert validate_ghana_phone("+233241234567") is True
    assert validate_ghana_phone("+233501234567") is True
    assert validate_ghana_phone("0241234567") is False  # Must be in international E.164

    assert detect_network("+233241234567") == "mtn"
    assert detect_network("+233501234567") == "telecel"
    assert detect_network("+233261234567") == "airteltigo"
