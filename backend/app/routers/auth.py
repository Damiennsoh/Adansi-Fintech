"""Authentication endpoints with full Supabase Auth integration."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.auth_service import auth_service
from app.services.supabase_client import supabase_auth
from app.services.redis_service import redis_service
from app.schemas.auth import (
    UserRegisterRequest, UserLoginRequest, OtpVerifyRequest,
    TokenResponse, PinResetRequest, PinResetConfirmRequest,
    GhanaCardVerifyRequest, PinSetupRequest, RefreshTokenRequest
)
from app.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(request: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user. Creates Supabase Auth user + local DB record."""
    if request.phone:
        existing = await db.execute(select(User).where(User.phone == request.phone))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already registered")
    normalized_email = request.email.lower().strip() if request.email else None
    if normalized_email:
        try:
            existing = await db.execute(select(User).where(User.email == normalized_email))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Email already registered")
        except HTTPException:
            raise
        except Exception:
            pass

    phone_for_auth = request.phone or f"+000{abs(hash(request.email or request.full_name)) % 1000000000:09d}"

    if normalized_email:
        supabase_result = await supabase_auth.sign_up_with_email(
            email=normalized_email,
            password=request.pin,
        )
    else:
        supabase_result = await supabase_auth.sign_up_with_phone(
            phone=phone_for_auth,
            password=request.pin,
        )
    auth_user_id = None
    if supabase_result.get("success"):
        sb_user = supabase_result.get("user")
        if sb_user and hasattr(sb_user, "id"):
            auth_user_id = sb_user.id

    if not supabase_result["success"]:
        if not normalized_email:
            raise HTTPException(status_code=400, detail=supabase_result.get("error", "Registration failed"))
        error_text = str(supabase_result.get("error", "")).lower()
        if any(token in error_text for token in ["phone", "sms", "otp", "twilio", "configured"]):
            pass
        else:
            raise HTTPException(status_code=400, detail=supabase_result.get("error", "Registration failed"))

    new_user = User(
        auth_user_id=auth_user_id,
        phone=request.phone,
        email=normalized_email,
        full_name=request.full_name,
        ghana_card_number=request.ghana_card_number,
        pin_hash=auth_service.hash_pin(request.pin),
        is_verified=bool(supabase_result.get("success"))
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except Exception as exc:
        await db.rollback()
        # Do not leave an Auth account without its local profile.
        if auth_user_id:
            try:
                supabase_auth.delete_user(auth_user_id)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail="Database error saving new user") from exc

    return {
        "message": "User registered successfully. Please verify your phone or continue with email-based onboarding.",
        "user_id": str(new_user.id),
        "phone": request.phone,
        "email": new_user.email,
    }


@router.patch("/profile")
async def update_profile(
    full_name: str,
    ghana_card_number: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update the authenticated user's onboarding profile."""
    user = current_user
    user.full_name = full_name.strip()
    if ghana_card_number:
        user.ghana_card_number = ghana_card_number.strip().upper()

    await db.commit()
    await db.refresh(user)

    return {
        "message": "Profile updated successfully",
        "user": {
            "id": str(user.id),
            "phone": user.phone,
            "full_name": user.full_name,
            "ghana_card_number": user.ghana_card_number,
            "role": user.role
        }
    }


@router.post("/send-otp")
async def send_otp(request: PinResetRequest):
    """Send OTP to phone number."""
    result = await supabase_auth.send_otp(request.phone)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return {"message": "OTP sent to your phone", "phone": request.phone}


@router.post("/verify-otp")
async def verify_otp(request: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify phone OTP from Supabase Auth."""
    result = await supabase_auth.verify_otp(request.phone, request.otp_token)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Invalid OTP"))

    # Mark user as verified in local DB
    user_result = await db.execute(select(User).where(User.phone == request.phone))
    user = user_result.scalar_one_or_none()
    if user:
        user.is_verified = True
        await db.commit()

    return {
        "message": "OTP verified successfully",
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": "bearer"
    }


@router.post("/login", response_model=TokenResponse)
async def login_user(request: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with phone + PIN. Returns Supabase JWT tokens."""
    print(f"Login attempt - Phone: {request.phone}, PIN: {request.pin}")
    
    identifier = request.identifier
    if request.phone:
        attempts = redis_service.get_pin_attempts(request.phone)
        if attempts >= 5:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    else:
        attempts = redis_service.get_pin_attempts(identifier)
        if attempts >= 5:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    try:
        user_result = await db.execute(
            select(User).where(
                (User.phone == request.phone) | (User.email == identifier.lower().strip())
            )
        )
    except Exception:
        # Older deployments may not yet have the email column in users.
        user_result = await db.execute(select(User).where(User.phone == request.phone))
    user = user_result.scalar_one_or_none()

    if user:
        print(f"User found by {user.phone or user.email}, PIN hash exists: {user.pin_hash is not None}")

    if not user or not auth_service.verify_pin(request.pin, user.pin_hash):
        print(f"PIN verification failed")
        redis_service.set_pin_attempts(request.phone or identifier, attempts + 1)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Reset failed attempts
    redis_service.set_pin_attempts(request.phone or identifier, 0)

    # Dispatch Supabase sign-in by the identifier the user actually owns.
    if user.email and not request.phone:
        supabase_result = await supabase_auth.sign_in_with_email(
            email=user.email,
            password=request.pin,
        )
    else:
        login_phone = request.phone or user.phone or f"+000{abs(hash(user.email or user.full_name)) % 1000000000:09d}"
        supabase_result = await supabase_auth.sign_in_with_phone(
            phone=login_phone,
            password=request.pin,
        )

    if not supabase_result["success"]:
        access_token = auth_service.create_access_token(user.id, user.phone)
        refresh_token = auth_service.create_refresh_token(user.id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=900
        )

    return TokenResponse(
        access_token=supabase_result["access_token"],
        refresh_token=supabase_result["refresh_token"],
        token_type="bearer",
        expires_in=900
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    # For Supabase, we would call supabase.auth.refresh_session()
    # For MVP: return the same token (client should handle re-login)
    return TokenResponse(
        access_token=request.refresh_token,
        refresh_token=request.refresh_token,
        token_type="bearer",
        expires_in=900
    )


@router.post("/setup-pin")
async def setup_pin(request: PinSetupRequest, db: AsyncSession = Depends(get_db)):
    """Set PIN during onboarding after profile setup."""
    user_result = await db.execute(select(User).where(User.phone == request.phone))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Complete profile setup first.")

    user.pin_hash = auth_service.hash_pin(request.pin)
    user.is_verified = True
    await db.commit()

    supabase_result = await supabase_auth.sign_up_with_phone(
        phone=request.phone,
        password=request.pin
    )

    if supabase_result["success"]:
        return TokenResponse(
            access_token=supabase_result.get("access_token", ""),
            refresh_token=supabase_result.get("refresh_token", ""),
            token_type="bearer",
            expires_in=900
        )

    return {"message": "PIN set successfully. Please login with your phone and PIN."}


@router.post("/forgot-pin")
async def forgot_pin(request: PinResetRequest):
    """Request PIN reset via SMS OTP."""
    result = await supabase_auth.send_otp(request.phone)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return {"message": "PIN reset OTP sent", "phone": request.phone}


@router.post("/reset-pin")
async def reset_pin(request: PinResetConfirmRequest, db: AsyncSession = Depends(get_db)):
    """Reset PIN with OTP verification."""
    # Verify OTP first
    otp_result = await supabase_auth.verify_otp(request.phone, request.otp)
    if not otp_result["success"]:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Update local PIN hash
    user_result = await db.execute(select(User).where(User.phone == request.phone))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.pin_hash = auth_service.hash_pin(request.new_pin)
    await db.commit()

    return {"message": "PIN reset successful. Please login with your new PIN."}


@router.post("/verify-ghana-card")
async def verify_ghana_card(request: GhanaCardVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Upload and verify Ghana Card for KYC."""
    # TODO: Decode base64 image, upload to Supabase Storage
    # For MVP: store the number, mark as pending verification
    return {"message": "Ghana Card submitted for verification. This may take 24-48 hours."}
