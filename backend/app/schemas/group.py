"""Group and member schemas."""
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal

VALID_GROUP_TYPES = {"funeral", "wedding", "susu", "school", "health", "investment", "savings", "business", "welfare"}
VALID_FREQUENCIES = {"daily", "weekly", "monthly", "adhoc", "one_time"}
VALID_APPROVAL_RULES = {"any_1_treasurer", "two_of_three_treasurers", "majority_members", "unanimous_members", "2_of_3", "majority", "unanimous"}
VALID_JOIN_TYPES = {"open", "approval_required", "invite_only"}


class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    type: str = Field(default="savings")
    # Allow both 'purpose' and 'description' as the group description field
    purpose: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=500)
    target_amount: Optional[Decimal] = Field(None, ge=0)
    withdrawal_threshold: Decimal = Field(default=500.00, ge=0)
    agent_verification_required: bool = False
    contribution_frequency: Optional[str] = Field(None)
    # Allow 'frequency' as alias for contribution_frequency
    frequency: Optional[str] = Field(None)
    contribution_amount: Optional[Decimal] = Field(None, ge=0)
    approval_rule: str = Field(default="any_1_treasurer")
    approval_timeout_hours: int = Field(default=24, ge=1, le=168)
    auto_approve_limit: Optional[Decimal] = Field(default=0, ge=0)
    join_type: Optional[str] = Field(default="approval_required")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        if v not in VALID_GROUP_TYPES:
            raise ValueError(f"type must be one of: {', '.join(sorted(VALID_GROUP_TYPES))}")
        return v

    @field_validator("approval_rule")
    @classmethod
    def validate_approval_rule(cls, v):
        # Normalize legacy values
        mapping = {"2_of_3": "two_of_three_treasurers", "majority": "majority_members", "unanimous": "unanimous_members"}
        return mapping.get(v, v)

    @field_validator("contribution_frequency", "frequency")
    @classmethod
    def validate_frequency(cls, v):
        if v is None:
            return v
        # Normalize one_time -> adhoc
        if v == "one_time":
            return "adhoc"
        if v not in VALID_FREQUENCIES:
            raise ValueError(f"frequency must be one of: {', '.join(sorted(VALID_FREQUENCIES))}")
        return v

    def get_purpose(self) -> Optional[str]:
        return self.purpose or self.description

    def get_frequency(self) -> Optional[str]:
        return self.contribution_frequency or self.frequency




class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str
    role: str
    joined_at: datetime
    total_contributed: Decimal
    contribution_streak: int


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    type: str
    purpose: Optional[str]
    target_amount: Optional[Decimal]
    current_balance: Decimal
    status: str
    withdrawal_threshold: Decimal
    agent_verification_required: bool
    contribution_frequency: Optional[str]
    contribution_amount: Optional[Decimal]
    created_at: datetime
    members: List[GroupMemberResponse] = []


class GroupListResponse(BaseModel):
    id: UUID
    name: str
    code: str
    type: str
    current_balance: Decimal
    my_role: str
    member_count: int


class JoinGroupRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=10)


class InviteMemberRequest(BaseModel):
    phone: Optional[str] = Field(None, pattern=r"^\+233[0-9]{9}$")
    channel: str = Field(default="whatsapp", pattern=r"^(whatsapp|sms)$")
