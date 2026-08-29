"""Credit score and loan schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal


class LoanApplyRequest(BaseModel):
    amount: Decimal = Field(..., ge=10, decimal_places=2)
    purpose: Optional[str] = Field(None, max_length=500)
    group_id: Optional[UUID] = None  # for group-backed loans


class LoanRepayRequest(BaseModel):
    amount: Decimal = Field(..., ge=1, decimal_places=2)


class GroupVouchRequest(BaseModel):
    approved: bool


class LoanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    group_id: Optional[UUID]
    amount: Decimal
    interest_rate: Decimal
    status: str
    purpose: Optional[str]
    due_date: Optional[date]
    total_repayable: Optional[Decimal]
    amount_repaid: Decimal
    created_at: datetime


class CreditScoreHistory(BaseModel):
    score: int
    calculated_at: datetime
