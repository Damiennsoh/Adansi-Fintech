"""Authentication and user-related Pydantic schemas."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserRegisterRequest(BaseModel):
    phone: Optional[str] = Field(None, description="Ghana or international mobile number, optional for diaspora signup")
    email: Optional[str] = Field(None, description="Email address used for diaspora onboarding when no Ghana SIM is available")
    full_name: str = Field(..., min_length=2, max_length=100)
    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    ghana_card_number: Optional[str] = Field(None, pattern=r"^GHA-[0-9]{9}-[0-9]{1}$")

    @property
    def primary_identifier(self) -> str:
        return self.email or self.phone or ""

    @property
    def has_phone(self) -> bool:
        return bool(self.phone and self.phone.strip())

    @property
    def has_email(self) -> bool:
        return bool(self.email and self.email.strip())

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        if isinstance(obj, dict):
            if not obj.get("phone") and not obj.get("email"):
                raise ValueError("Either phone or email is required")
            phone = obj.get("phone")
            email = obj.get("email")
            if phone and not isinstance(phone, str):
                obj = {**obj, "phone": str(phone)}
            if email and not isinstance(email, str):
                obj = {**obj, "email": str(email)}
        return super().model_validate(obj, *args, **kwargs)


class UserLoginRequest(BaseModel):
    phone: Optional[str] = Field(None, description="Ghana number when using phone-based login")
    email: Optional[str] = Field(None, description="Email-based login for diaspora onboarding")
    pin: str = Field(..., min_length=4, max_length=6)

    @property
    def identifier(self) -> str:
        return self.email or self.phone or ""

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        if isinstance(obj, dict):
            if not obj.get("phone") and not obj.get("email"):
                raise ValueError("Either phone or email is required")
        return super().model_validate(obj, *args, **kwargs)


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


class RefreshTokenRequest(BaseModel):
    refresh_token: str
