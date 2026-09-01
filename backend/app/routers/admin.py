from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user, require_admin
from app.models import User, Group, GroupMember, Contribution, Transaction, AuditEvent

router = APIRouter(prefix="/admin", tags=["Admin"])


async def require_platform_admin(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Platform admin gate for root-level admin endpoints."""
    if getattr(user, "role", "user") not in {"platform_admin", "super_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return user


# Backwards-compatible alias used by the wider app and tests.
require_admin = require_platform_admin


@router.get("/overview")
async def overview(_: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db)):
    users = await db.scalar(select(func.count(User.id)))
    groups = await db.scalar(select(func.count(Group.id)))
    volume = await db.scalar(select(func.coalesce(func.sum(Contribution.amount), 0)).where(Contribution.status == "completed"))
    pending = await db.scalar(select(func.count(Contribution.id)).where(Contribution.status == "pending"))
    recent = await db.execute(
        select(Contribution, User.full_name, Group.name)
        .join(User, User.id == Contribution.user_id)
        .join(Group, Group.id == Contribution.group_id)
        .order_by(Contribution.created_at.desc())
        .limit(20)
    )
    hubtel = "connected" if getattr(__import__('app.config', fromlist=['get_settings']).get_settings(), "hubtel_client_id", None) and getattr(__import__('app.config', fromlist=['get_settings']).get_settings(), "hubtel_client_secret", None) and getattr(__import__('app.config', fromlist=['get_settings']).get_settings(), "hubtel_merchant_id", None) else "not_configured"
    twilio = "connected" if getattr(__import__('app.config', fromlist=['get_settings']).get_settings(), "twilio_account_sid", None) and getattr(__import__('app.config', fromlist=['get_settings']).get_settings(), "twilio_auth_token", None) and getattr(__import__('app.config', fromlist=['get_settings']).get_settings(), "twilio_whatsapp_number", None) else "not_configured"
    return {
        "stats": {
            "totalUsers": users or 0,
            "totalGroups": groups or 0,
            "totalVolume": float(volume or 0),
            "pendingVerifications": pending or 0,
        },
        "providers": {
            "hubtel": hubtel,
            "twilio": twilio,
        },
        "transactions": [
            {
                "id": str(c.id),
                "type": "contribution",
                "amount": float(c.amount),
                "user": name,
                "group": group,
                "status": c.status,
                "time": c.created_at,
            }
            for c, name, group in recent.all()
        ],
    }


@router.get("/audit")
async def audit_log(_: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db)):
    """Return recent platform-wide audit events for admin review."""
    result = await db.execute(
        select(AuditEvent)
        .order_by(AuditEvent.created_at.desc())
        .limit(100)
    )
    events = result.scalars().all()
    return {
        "events": [
            {
                "id": str(event.id),
                "group_id": str(event.group_id),
                "actor_id": str(event.actor_id) if event.actor_id else None,
                "event_type": event.event_type,
                "entity_type": event.entity_type,
                "entity_id": str(event.entity_id) if event.entity_id else None,
                "amount": float(event.amount) if event.amount is not None else None,
                "metadata": event.event_metadata,
                "created_at": event.created_at,
            }
            for event in events
        ]
    }
