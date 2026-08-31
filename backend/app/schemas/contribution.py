"""Contribution and transaction schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class ContributionCreateRequest(BaseModel):
    group_id: UUID
    amount: Decimal = Field(..., ge=1, decimal_places=2)
    method: str = Field(default="momo", pattern=r"^(momo|bank|diaspora|agent_cash)$")
    network: str = Field(default="mtn", pattern=r"^(mtn|telecel|airteltigo)$")


class ContributionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    user_id: UUID
    amount: Decimal
    method: str
    transaction_ref: Optional[str]
    status: str
    momo_transaction_id: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    reference: str
    amount: Decimal
    status: str
    external_ref: Optional[str]
    created_at: datetime


class MomoCallbackPayload(BaseModel):
    """Hubtel callback payload structure."""
    ResponseCode: str
    Data: Dict[str, Any]
