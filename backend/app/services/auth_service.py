"""Authentication service: Supabase Auth integration + PIN management."""
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import User
from sqlalchemy import select

settings = get_settings()


class AuthService:
    """Handles user authentication, PIN hashing, and JWT verification."""

    @staticmethod
    def hash_pin(pin: str) -> str:
        """Hash a 4-6 digit PIN using bcrypt."""
        return bcrypt.hashpw(pin.encode(), bcrypt.gensalt(rounds=12)).decode()

    @staticmethod
    def verify_pin(pin: str, hashed: str) -> bool:
        """Verify a PIN against its bcrypt hash."""
        return bcrypt.checkpw(pin.encode(), hashed.encode())

    @staticmethod
    def create_access_token(user_id: UUID, phone: str) -> str:
        """Create a JWT access token (15 min expiry)."""
        payload = {
            "sub": str(user_id),
            "phone": phone,
            "type": "access",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(minutes=15)
        }
        return jwt.encode(payload, settings.secret_key, algorithm="HS256")

    @staticmethod
    def create_refresh_token(user_id: UUID) -> str:
        """Create a JWT refresh token (7 day expiry)."""
        payload = {
            "sub": str(user_id),
            "type": "refresh",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        return jwt.encode(payload, settings.secret_key, algorithm="HS256")

    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """Verify a JWT token and return its payload."""
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    @staticmethod
    async def get_user_by_phone(phone: str) -> Optional[User]:
        """Fetch user by phone number."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(User).where(User.phone == phone))
            return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(user_id: UUID) -> Optional[User]:
        """Fetch user by UUID."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()


auth_service = AuthService()
