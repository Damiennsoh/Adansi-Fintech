"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    """Centralized app settings."""

    # App
    app_name: str = Field(default="ADANSI", alias="APP_NAME")
    debug: bool = Field(default=False, alias="DEBUG")
    secret_key: str = Field(alias="SECRET_KEY")

    # Supabase
    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_key: str = Field(alias="SUPABASE_KEY")
    supabase_service_role_key: str = Field(alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = Field(alias="SUPABASE_JWT_SECRET")

    # Database
    database_url: str = Field(alias="DATABASE_URL")

    # Redis
    redis_url: str = Field(alias="REDIS_URL")

    # Hubtel (MoMo)
    hubtel_client_id: str | None = Field(default=None, alias="HUBTEL_CLIENT_ID")
    hubtel_client_secret: str | None = Field(default=None, alias="HUBTEL_CLIENT_SECRET")
    hubtel_merchant_id: str | None = Field(default=None, alias="HUBTEL_MERCHANT_ID")
    hubtel_base_url: str = Field(default="https://api.hubtel.com/v1", alias="HUBTEL_BASE_URL")

    # Twilio (optional until WhatsApp/SMS is enabled)
    twilio_account_sid: str | None = Field(default=None, alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str | None = Field(default=None, alias="TWILIO_AUTH_TOKEN")
    twilio_whatsapp_number: str | None = Field(default=None, alias="TWILIO_WHATSAPP_NUMBER")
    twilio_sandbox_code: str | None = Field(default=None, alias="TWILIO_SANDBOX_CODE")

    # Public API origin used for provider callbacks
    api_public_url: str | None = Field(default=None, alias="API_PUBLIC_URL")

    # NIA (Ghana Card KYC)
    nia_api_key: str | None = Field(default=None, alias="NIA_API_KEY")
    nia_base_url: str = Field(default="https://api.nia.gov.gh", alias="NIA_BASE_URL")

    # Frontend
    frontend_url: str = Field(default="http://localhost:5173", alias="FRONTEND_URL")
    frontend_urls: str | None = Field(default=None, alias="FRONTEND_URLS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Singleton settings instance."""
    return Settings()
