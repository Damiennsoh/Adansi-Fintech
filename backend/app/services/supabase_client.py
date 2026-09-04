"""Supabase client wrapper for Auth, Storage, and direct DB access."""
from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()

# Public client (for auth operations)
supabase: Client = create_client(settings.supabase_url, settings.supabase_key)

# Service role client (for admin operations like creating users, bypassing RLS)
supabase_admin: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


class SupabaseAuthService:
    """Wraps Supabase Auth operations."""

    @staticmethod
    async def sign_up_with_phone(phone: str, password: str) -> dict:
        """Register user with phone + password (PIN used as password)."""
        try:
            response = supabase.auth.sign_up({
                "phone": phone,
                "password": password
            })
            return {"success": True, "user": response.user, "session": response.session}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def sign_up_with_email(email: str, password: str) -> dict:
        """Register a diaspora user with email + PIN. Supabase will send a confirmation email."""
        try:
            cleaned_email = email.lower().strip()
            response = supabase.auth.sign_up({
                "email": cleaned_email,
                "password": password,
            })
            return {"success": True, "user": response.user, "session": response.session}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def sign_in_with_phone(phone: str, password: str) -> dict:
        """Login with phone + password."""
        try:
            response = supabase.auth.sign_in_with_password({
                "phone": phone,
                "password": password
            })
            return {"success": True, "access_token": response.session.access_token, "refresh_token": response.session.refresh_token}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def sign_in_with_email(email: str, password: str) -> dict:
        """Login diaspora user with email + PIN."""
        try:
            cleaned_email = email.lower().strip()
            response = supabase.auth.sign_in_with_password({
                "email": cleaned_email,
                "password": password
            })
            return {"success": True, "access_token": response.session.access_token, "refresh_token": response.session.refresh_token}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def send_otp(phone: str) -> dict:
        """Send OTP to phone number."""
        try:
            response = supabase.auth.sign_in_with_otp({"phone": phone})
            return {"success": True, "message": "OTP sent"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def verify_otp(phone: str, token: str) -> dict:
        """Verify OTP and return session."""
        try:
            response = supabase.auth.verify_otp({
                "phone": phone,
                "token": token,
                "type": "sms"
            })
            return {"success": True, "access_token": response.session.access_token, "refresh_token": response.session.refresh_token}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def delete_user(user_id: str) -> None:
        """Remove an Auth user when local profile creation cannot be completed."""
        supabase_admin.auth.admin.delete_user(user_id)

    @staticmethod
    async def get_user_by_token(jwt_token: str) -> dict:
        """Verify JWT and return user payload."""
        try:
            response = supabase.auth.get_user(jwt_token)
            return {"success": True, "user": response.user}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def upload_ghana_card(file_bytes: bytes, file_name: str, user_id: str) -> dict:
        """Upload Ghana Card image to Supabase Storage."""
        try:
            response = supabase_admin.storage.from_("ghana-cards").upload(
                path=f"{user_id}/{file_name}",
                file=file_bytes,
                file_options={"content-type": "image/jpeg"}
            )
            # Get public URL
            url = supabase_admin.storage.from_("ghana-cards").get_public_url(f"{user_id}/{file_name}")
            return {"success": True, "url": url}
        except Exception as e:
            return {"success": False, "error": str(e)}


supabase_auth = SupabaseAuthService()
