"""Authentication and user-related Pydantic schemas."""
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserRegisterRequest(BaseModel):
    phone: Optional[str] = Field(None, description="Ghana or international mobile number, optional for diaspora signup")
    email: Optional[str] = Field(None, description="Email address used for diaspora onboarding when no Ghana SIM is available")
    full_name: str = Field(..., min_length=2, max_length=100)
    pin: Optional[str] = Field(None, min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    password: Optional[str] = Field(None, min_length=6, max_length=128)
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

    @model_validator(mode="after")
    def validate_credentials(self):
        if not self.phone and not self.email:
            raise ValueError("Either phone or email is required")
        if self.email and not self.password:
            raise ValueError("Password is required for email signup")
        if self.phone and not self.pin:
            raise ValueError("PIN is required for phone signup")
        return self


class UserLoginRequest(BaseModel):
    phone: Optional[str] = Field(None, description="Ghana number when using phone-based login")
    email: Optional[str] = Field(None, description="Email-based login for diaspora onboarding")
    pin: Optional[str] = Field(None, min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    password: Optional[str] = Field(None, min_length=6, max_length=128)

    @property
    def identifier(self) -> str:
        return self.email or self.phone or ""

    @model_validator(mode="after")
    def validate_credentials(self):
        if not self.phone and not self.email:
            raise ValueError("Either phone or email is required")
        if self.email and not self.password:
            raise ValueError("Password is required for email login")
        if self.phone and not self.pin:
            raise ValueError("PIN is required for phone login")
        return self


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
