from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models import User, Group, GroupMember, Contribution, Transaction, AuditEvent

router = APIRouter(prefix="/admin", tags=["Admin"])

async def require_admin(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if getattr(user, "role", "user") not in {"platform_admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return user

@router.get("/overview")
async def overview(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    users = await db.scalar(select(func.count(User.id)))
    groups = await db.scalar(select(func.count(Group.id)))
    volume = await db.scalar(select(func.coalesce(func.sum(Contribution.amount), 0)).where(Contribution.status == "completed"))
    pending = await db.scalar(select(func.count(Contribution.id)).where(Contribution.status == "pending"))
    recent = await db.execute(select(Contribution, User.full_name, Group.name).join(User, User.id == Contribution.user_id).join(Group, Group.id == Contribution.group_id).order_by(Contribution.created_at.desc()).limit(20))
    return {"stats": {"totalUsers": users or 0, "totalGroups": groups or 0, "totalVolume": float(volume or 0), "pendingVerifications": pending or 0}, "transactions": [{"id": str(c.id), "type": "contribution", "amount": float(c.amount), "user": name, "group": group, "status": c.status, "time": c.created_at} for c, name, group in recent.all()]}
