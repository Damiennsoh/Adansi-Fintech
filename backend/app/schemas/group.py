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
    rotation_enabled: bool = False
    rotation_queue: Optional[list] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        normalized = v.strip().lower()
        if normalized in VALID_GROUP_TYPES:
            return normalized
        # Custom group types are stored as a short, normalized slug.
        if len(normalized) < 3 or len(normalized) > 30:
            raise ValueError("custom group type must be between 3 and 30 characters")
        if not all(char.isalnum() or char == "_" for char in normalized):
            raise ValueError("custom group type may contain only letters, numbers, and underscores")
        return normalized

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
    full_name: str = ""
    role: str
    joined_at: datetime
    total_contributed: Decimal = Decimal("0")
    contribution_streak: int = 0

    @field_validator("full_name", mode="before")
    @classmethod
    def extract_full_name(cls, value, info):
        if value not in (None, ""):
            return value
        obj = info.data if isinstance(info.data, object) else None
        if obj is None:
            return ""
        user = getattr(obj, "user", None)
        if user is not None:
            return getattr(user, "full_name", "")
        return ""

    @field_validator("total_contributed", mode="before")
    @classmethod
    def normalize_total_contributed(cls, value):
        if value in (None, ""):
            return Decimal("0")
        return value


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
    agent_verification_required: bool = False
    contribution_frequency: Optional[str]
    contribution_amount: Optional[Decimal]
    approval_rule: str = "any_1_treasurer"
    auto_approve_limit: Decimal = Decimal("0")
    join_type: str = "approval_required"
    rotation_enabled: bool = False
    created_at: datetime
    members: List[GroupMemberResponse] = []

    @field_validator("agent_verification_required", "rotation_enabled", mode="before")
    @classmethod
    def normalize_bool(cls, value):
        if value is None:
            return False
        return bool(value)

    @field_validator("auto_approve_limit", mode="before")
    @classmethod
    def normalize_auto_approve_limit(cls, value):
        if value in (None, ""):
            return Decimal("0")
        return Decimal(str(value))

    @field_validator("members", mode="before")
    @classmethod
    def normalize_members(cls, value):
        if value is None:
            return []
        if isinstance(value, list):
            return [
                GroupMemberResponse.model_validate(item) if not isinstance(item, dict) else GroupMemberResponse.model_validate(item)
                for item in value
            ]
        return []


class GroupListResponse(BaseModel):
    id: UUID
    name: str
    code: str
    type: str
    current_balance: Decimal
    my_role: str
    member_count: int


class GroupSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    type: str
    current_balance: Decimal = Decimal("0")
    member_count: int = 0


class JoinGroupRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=10)


class InviteMemberRequest(BaseModel):
    phone: Optional[str] = Field(None, pattern=r"^\+233[0-9]{9}$")
    channel: str = Field(default="whatsapp", pattern=r"^(whatsapp|sms)$")
