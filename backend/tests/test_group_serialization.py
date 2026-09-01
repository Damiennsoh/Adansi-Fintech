from datetime import datetime
from uuid import uuid4

from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.auth import UserRegisterRequest
from app.schemas.contribution import ContributionCreateRequest
from app.schemas.group import GroupResponse, GroupMemberResponse, GroupSearchResponse


def test_group_member_response_uses_member_user_full_name():
    user = User(
        id=uuid4(),
        phone="+233240000000",
        full_name="Ada Mensah",
        role="user",
        is_verified=True,
    )
    member = GroupMember(
        id=uuid4(),
        group_id=uuid4(),
        user_id=user.id,
        role="admin",
        joined_at=datetime.utcnow(),
        total_contributed=0,
        contribution_streak=0,
        user=user,
    )

    payload = GroupMemberResponse.model_validate(member)

    assert payload.full_name == "Ada Mensah"
    assert payload.role == "admin"


def test_group_response_includes_member_details():
    user = User(
        id=uuid4(),
        phone="+233240000001",
        full_name="Kwame Boateng",
        role="user",
        is_verified=True,
    )
    group = Group(
        id=uuid4(),
        name="Test Group",
        code="ABCD12",
        type="savings",
        created_by=user.id,
        current_balance=250,
        status="active",
        withdrawal_threshold=500,
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
                total_contributed=100,
                contribution_streak=2,
                user=user,
            )
        ],
    )

    payload = GroupResponse.model_validate(group)

    assert payload.name == "Test Group"
    assert payload.members[0].full_name == "Kwame Boateng"
    assert payload.members[0].role == "admin"


def test_user_register_request_allows_email_based_diaspora_signup():
    payload = UserRegisterRequest.model_validate({
        "email": "diaspora@example.com",
        "full_name": "Ama Boateng",
        "pin": "1234",
    })

    assert payload.email == "diaspora@example.com"
    assert payload.full_name == "Ama Boateng"


def test_contribution_request_accepts_payer_name_and_metadata():
    payload = ContributionCreateRequest.model_validate({
        "group_id": "11111111-1111-4111-8111-111111111111",
        "amount": 50.00,
        "method": "diaspora",
        "payer_name": "Kofi Mensah",
    })

    assert payload.payer_name == "Kofi Mensah"
    assert payload.method == "diaspora"


def test_group_search_response_uses_name_and_code_fields():
    payload = GroupSearchResponse.model_validate({
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Accra Savings Circle",
        "code": "ACCRA1",
        "type": "savings",
        "current_balance": 100.50,
        "member_count": 12,
    })

    assert payload.name == "Accra Savings Circle"
    assert payload.code == "ACCRA1"
    assert payload.member_count == 12
