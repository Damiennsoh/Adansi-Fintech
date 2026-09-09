"""User profile and credit profile schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone: Optional[str] = None
    email: Optional[str] = None
    full_name: str
    ghana_card_number: Optional[str] = None
    is_verified: bool
    credit_score: int
    total_contributed: Decimal
    groups_count: int
    unread_notifications: int = 0
    created_at: datetime


class CreditProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    score: int
    consistency_rating: Decimal
    total_contributed_all_time: Decimal
    active_groups: int
    loan_eligible: bool
    max_loan_amount: Decimal
    total_loans_taken: int
    total_loans_repaid: int
    default_rate: Decimal
    last_calculated_at: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    channel: str
    type: str
    content: str
    status: str
    created_at: datetime


class GhanaCardSubmitRequest(BaseModel):
    ghana_card_number: str = Field(..., pattern=r"^GHA-[0-9]{9}-[0-9]{1}$")


class NotificationPreferencesRequest(BaseModel):
    whatsapp_enabled: bool = True
    sms_enabled: bool = True
    push_enabled: bool = True
    contributions_alert: bool = True
    withdrawals_alert: bool = True
    loans_alert: bool = True

