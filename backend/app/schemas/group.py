"""Group and member schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    type: str = Field(..., pattern=r"^(funeral|wedding|susu|school|health|investment)$")
    purpose: Optional[str] = Field(None, max_length=500)
    target_amount: Optional[Decimal] = Field(None, ge=0)
    withdrawal_threshold: Decimal = Field(default=500.00, ge=0)
    agent_verification_required: bool = True
    contribution_frequency: Optional[str] = Field(None, pattern=r"^(daily|weekly|monthly|adhoc)$")
    contribution_amount: Optional[Decimal] = Field(None, ge=0)


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
