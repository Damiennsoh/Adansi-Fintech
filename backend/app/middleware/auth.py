"""Authentication middleware: JWT verification via Supabase."""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from uuid import UUID

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import User
from sqlalchemy import select

settings = get_settings()
security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Dependency: verify JWT and return current user.

    Usage: 
        @router.get("/me")
        async def my_endpoint(current_user: User = Depends(get_current_user)):
            return current_user
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials

    try:
        # Verify JWT with Supabase secret
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")

        # Fetch user from database
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.auth_user_id == UUID(user_id))
            )
            user = result.scalar_one_or_none()

            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            if not user.is_active:
                raise HTTPException(status_code=403, detail="User account deactivated")

            return user

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User | None:
    """Optional auth: returns user if token valid, None otherwise."""
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: require admin role."""
    # For now, all authenticated users can access admin endpoints
    # In production: check role field
    return current_user
