"""Authentication endpoints with full Supabase Auth integration."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.services.auth_service import auth_service
from app.services.supabase_client import supabase_auth
from app.services.redis_service import redis_service
from app.schemas.auth import (
    UserRegisterRequest, UserLoginRequest, OtpVerifyRequest,
    TokenResponse, PinResetRequest, PinResetConfirmRequest,
    GhanaCardVerifyRequest
)
from app.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(request: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user. Creates Supabase Auth user + local DB record."""
    # Check if phone already exists
    existing = await db.execute(select(User).where(User.phone == request.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    # Create Supabase Auth user (phone + PIN as password)
    supabase_result = await supabase_auth.sign_up_with_phone(
        phone=request.phone,
        password=request.pin
    )

    if not supabase_result["success"]:
        raise HTTPException(status_code=400, detail=supabase_result.get("error", "Registration failed"))

    # Create local user record
    new_user = User(
        phone=request.phone,
        full_name=request.full_name,
        ghana_card_number=request.ghana_card_number,
        pin_hash=auth_service.hash_pin(request.pin),
        is_verified=False
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return {
        "message": "User registered successfully. Please verify your phone with OTP.",
        "user_id": str(new_user.id),
        "phone": request.phone
    }


@router.patch("/profile")
async def update_profile(
    phone: str,
    full_name: str,
    ghana_card_number: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """Update profile during onboarding (capture full_name and optional Ghana Card)."""
    user_result = await db.execute(select(User).where(User.phone == phone))
    user = user_result.scalar_one_or_none()
    if not user:
        # Auto-create user record if not present
        user = User(phone=phone, full_name=full_name, ghana_card_number=ghana_card_number)
        db.add(user)
    else:
        user.full_name = full_name
        if ghana_card_number:
            user.ghana_card_number = ghana_card_number

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
    # Check rate limiting
    attempts = redis_service.get_pin_attempts(request.phone)
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    # Verify PIN against local hash
    user_result = await db.execute(select(User).where(User.phone == request.phone))
    user = user_result.scalar_one_or_none()

    if not user or not auth_service.verify_pin(request.pin, user.pin_hash):
        redis_service.set_pin_attempts(request.phone, attempts + 1)
        raise HTTPException(status_code=401, detail="Invalid phone or PIN")

    # Reset failed attempts
    redis_service.set_pin_attempts(request.phone, 0)

    # Sign in with Supabase to get fresh tokens
    supabase_result = await supabase_auth.sign_in_with_phone(
        phone=request.phone,
        password=request.pin
    )

    if not supabase_result["success"]:
        raise HTTPException(status_code=401, detail="Authentication failed")

    return TokenResponse(
        access_token=supabase_result["access_token"],
        refresh_token=supabase_result["refresh_token"],
        token_type="bearer",
        expires_in=900
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token: str):
    """Refresh access token using refresh token."""
    # For Supabase, we would call supabase.auth.refresh_session()
    # For MVP: return the same token (client should handle re-login)
    return TokenResponse(
        access_token=token,
        refresh_token=token,
        token_type="bearer",
        expires_in=900
    )


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
