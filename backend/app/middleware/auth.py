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
    payload = None
    user_id = None

    print(f"Auth middleware: Attempting to verify token")

    # Try Supabase JWT first
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        print(f"Auth middleware: Supabase JWT success, user_id: {user_id}")
    except JWTError as e:
        print(f"Auth middleware: Supabase JWT failed: {e}")
        pass

    # Fall back to local JWT if Supabase fails
    if not user_id:
        try:
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=["HS256"]
            )
            user_id = payload.get("sub")
            print(f"Auth middleware: Local JWT success, user_id: {user_id}")
        except JWTError as e:
            print(f"Auth middleware: Local JWT failed: {e}")
            pass

    if not user_id:
        print(f"Auth middleware: No valid user_id found in token")
        raise HTTPException(status_code=401, detail="Invalid token: no user ID")

    # Fetch user from database
    async with AsyncSessionLocal() as session:
        # Try by auth_user_id first (Supabase), then by id (local)
        user = None
        try:
            result = await session.execute(
                select(User).where(User.auth_user_id == UUID(user_id))
            )
            user = result.scalar_one_or_none()
            print(f"Auth middleware: User found by auth_user_id: {user is not None}")
        except Exception as e:
            print(f"Auth middleware: Error searching by auth_user_id: {e}")
            user = None
        
        if not user:
            result = await session.execute(
                select(User).where(User.id == UUID(user_id))
            )
            user = result.scalar_one_or_none()
            print(f"Auth middleware: User found by id: {user is not None}")

        if not user:
            print(f"Auth middleware: User not found in database")
            raise HTTPException(status_code=404, detail="User not found")

        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account deactivated")

        print(f"Auth middleware: Authentication successful for user {user.phone}")
        return user


async def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User | None:
    """Optional auth: returns user if token valid, None otherwise."""
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: require a platform administrator role."""
    if getattr(current_user, "role", "user") not in ["platform_admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
