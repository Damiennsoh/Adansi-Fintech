"""User profile and credit profile endpoints with full CRUD."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.credit_service import credit_engine
from app.schemas.user import UserProfileResponse, CreditProfileResponse, NotificationResponse
from app.models import User, CreditProfile, Notification

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current user profile."""
    return current_user


@router.put("/me")
async def update_profile(full_name: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update user profile."""
    current_user.full_name = full_name
    await db.commit()
    return {"message": "Profile updated", "user_id": str(current_user.id)}


@router.get("/me/credit-profile")
async def get_credit_profile(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get detailed credit profile with score breakdown."""
    # Trigger recalculation
    result = await credit_engine.calculate_score(current_user.id)

    return {
        "user_id": str(current_user.id),
        "credit_score": result["score"],
        "tier": result["tier"],
        "loan_eligible": result["loan_eligible"],
        "max_loan_amount": result["max_loan_amount"],
        "breakdown": result["breakdown"],
        "calculated_at": result["calculated_at"]
    }


@router.get("/me/notifications")
async def get_notifications(limit: int = 20, offset: int = 0, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List user notifications with pagination."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    notifications = result.scalars().all()
    return {"notifications": notifications, "count": len(notifications)}


@router.put("/me/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Mark notification as read."""
    notif = await db.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.status = "read"
    await db.commit()
    return {"message": "Notification marked as read"}
