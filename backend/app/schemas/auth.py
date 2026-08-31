"""Authentication and user-related Pydantic schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserRegisterRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+233[0-9]{9}$", description="Ghana phone number e.g. +233241234567")
    full_name: str = Field(..., min_length=2, max_length=100)
    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    ghana_card_number: Optional[str] = Field(None, pattern=r"^GHA-[0-9]{9}-[0-9]{1}$")


class UserLoginRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+233[0-9]{9}$")
    pin: str = Field(..., min_length=4, max_length=6)


class OtpVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+233[0-9]{9}$")
    otp_token: str = Field(..., min_length=4)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 minutes


class PinSetupRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+233[0-9]{9}$")
    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")


class PinResetRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+233[0-9]{9}$")


class PinResetConfirmRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+233[0-9]{9}$")
    otp: str = Field(..., min_length=4)
    new_pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")


class GhanaCardVerifyRequest(BaseModel):
    ghana_card_number: str = Field(..., pattern=r"^GHA-[0-9]{9}-[0-9]{1}$")
    image_base64: str = Field(..., min_length=100)
