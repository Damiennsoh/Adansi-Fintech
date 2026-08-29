"""Withdrawal and approval schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class WithdrawalCreateRequest(BaseModel):
    group_id: UUID
    amount: Decimal = Field(..., ge=1, decimal_places=2)
    reason: str = Field(..., min_length=5, max_length=500)


class WithdrawalApprovalRequest(BaseModel):
    approved: bool


class WithdrawalApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    member_id: UUID
    approved: bool
    channel: str
    created_at: datetime


class AgentVerifyRequest(BaseModel):
    agent_id: str = Field(..., min_length=1)
    ghana_card_verified: bool
    biometric_verified: bool
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class WithdrawalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    requested_by: UUID
    amount: Decimal
    reason: str
    status: str
    approval_count: int
    approval_required: int
    agent_id: Optional[str]
    agent_verified_at: Optional[datetime]
    disbursed_at: Optional[datetime]
    approvals: List[WithdrawalApprovalResponse] = []
    created_at: datetime
