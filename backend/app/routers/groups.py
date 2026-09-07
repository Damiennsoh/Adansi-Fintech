"""Group management endpoints with full CRUD."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List
from datetime import datetime

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.group_service import group_service
from app.services.notification_service import notification_service
from app.schemas.group import (
    GroupCreateRequest, GroupUpdateRequest, GroupResponse, GroupListResponse,
    JoinGroupRequest, InviteMemberRequest
)
from app.models import Group, GroupMember, User, Contribution, Withdrawal, AuditEvent, JoinRequest

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    request: GroupCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new group. Auto-generates short code."""
    group = await group_service.create_group(
        name=request.name,
        type=request.type,
        purpose=request.get_purpose(),
        target_amount=request.target_amount,
        withdrawal_threshold=request.withdrawal_threshold,
        agent_verification_required=request.agent_verification_required,
        contribution_frequency=request.get_frequency(),
        contribution_amount=request.contribution_amount,
        created_by=current_user.id,
        approval_rule=request.approval_rule,
        approval_timeout_hours=request.approval_timeout_hours,
        auto_approve_limit=float(request.auto_approve_limit or 0),
        join_type=request.join_type or "approval_required",
        rotation_enabled=request.rotation_enabled,
        rotation_queue=request.rotation_queue,
    return group


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID,
    request: GroupUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update group settings (admin or group creator only)."""
    try:
        admin_check = await db.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
                GroupMember.role.in_(["admin", "treasurer"]),
                GroupMember.archived_at.is_(None)
            )
        )
    except Exception:
        admin_check = await db.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
                GroupMember.role.in_(["admin", "treasurer"])
            )
        )

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not admin_check and group.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only group admins can modify group settings")

    changes = {}
    if request.name is not None and request.name != group.name:
        changes["name"] = request.name
        group.name = request.name
    if request.type is not None and request.type != group.type:
        changes["type"] = request.type
        group.type = request.type
    if request.purpose is not None and request.purpose != group.purpose:
        changes["purpose"] = request.purpose
        group.purpose = request.purpose
    if request.target_amount is not None:
        changes["target_amount"] = float(request.target_amount)
        group.target_amount = request.target_amount
    if request.contribution_amount is not None:
        changes["contribution_amount"] = float(request.contribution_amount)
        group.contribution_amount = request.contribution_amount
    if request.contribution_frequency is not None:
        changes["contribution_frequency"] = request.contribution_frequency
        group.contribution_frequency = request.contribution_frequency
    if request.approval_rule is not None:
        changes["approval_rule"] = request.approval_rule
        group.approval_rule = request.approval_rule
    if request.auto_approve_limit is not None:
        changes["auto_approve_limit"] = float(request.auto_approve_limit)
        group.auto_approve_limit = request.auto_approve_limit

    if changes:
        db.add(AuditEvent(
            group_id=group_id,
            actor_id=current_user.id,
            event_type="group_settings_updated",
            entity_type="group",
            entity_id=group.id,
            event_metadata={"changes": changes}
        ))
        await db.commit()
        await db.refresh(group)

    return group


@router.get("", response_model=List[GroupListResponse])
async def list_my_groups(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all groups the current user belongs to."""
    result = await db.execute(
        select(Group, GroupMember.role)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .where(GroupMember.user_id == current_user.id)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
    )
    rows = result.all()

    return [
        {
            "id": group.id,
            "name": group.name,
            "code": group.code,
            "type": group.type,
            "current_balance": group.current_balance,
            "my_role": role,
            "member_count": len(group.members)
        }
        for group, role in rows
    ]


@router.get("/search")
async def search_groups(query: str, db: AsyncSession = Depends(get_db)):
    """Search groups by code or name for diaspora discovery flows."""
    if not query or not query.strip():
        return []

    groups = await group_service.search_groups(query)
    return [
        {
            "id": group.id,
            "name": group.name,
            "code": group.code,
            "type": group.type,
            "current_balance": float(group.current_balance or 0),
            "members": len(group.members),
            "balance": float(group.current_balance or 0),
            "member_count": len(group.members),
        }
        for group in groups
    ]


@router.get("/code/{code}")
async def get_group_by_code(code: str, db: AsyncSession = Depends(get_db)):
    """Lookup group by short code (for USSD joining)."""
    group = await group_service.get_group_by_code(code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    member_count = len(group.members)
    return {
        "id": group.id,
        "name": group.name,
        "code": group.code,
        "type": group.type,
        "current_balance": float(group.current_balance or 0),
        "members": member_count,
        "balance": float(group.current_balance or 0),
        "member_count": member_count,
    }


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get group details, members, and recent activity."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
        .where(Group.id == group_id)
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await group_service.reconcile_group_balance(db, group_id)
    await db.commit()
    return group


@router.post("/{group_id}/join")
async def join_group(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create a join request; admins approve membership."""
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    existing = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    if existing.scalar_one_or_none():
        return {"message": "Already a member", "status": "approved"}
    pending = await db.scalar(select(JoinRequest).where(JoinRequest.group_id == group_id, JoinRequest.user_id == current_user.id, JoinRequest.status == "pending"))
    if pending:
        return {"message": "Join request already pending", "request_id": str(pending.id), "status": "pending"}

    request = JoinRequest(group_id=group_id, user_id=current_user.id)
    db.add(request)
    await db.flush()
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="join_requested", entity_type="join_request", entity_id=request.id))
    await db.commit()
    return {"message": "Join request submitted", "request_id": str(request.id), "status": "pending"} 

@router.get("/{group_id}/audit")
async def get_group_audit(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    member = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))
    if not member.scalar_one_or_none(): raise HTTPException(status_code=403, detail="Not a member")
    result = await db.execute(select(AuditEvent, User.full_name.label("actor_name")).outerjoin(User, AuditEvent.actor_id == User.id).where(AuditEvent.group_id == group_id).order_by(AuditEvent.created_at.desc()).limit(100))
    return {"events": [{"id": str(e.id), "event_type": e.event_type, "entity_type": e.entity_type, "entity_id": str(e.entity_id) if e.entity_id else None, "amount": float(e.amount) if e.amount is not None else None, "metadata": e.event_metadata, "actor_id": str(e.actor_id) if e.actor_id else None, "actor_name": actor_name or "System", "created_at": e.created_at} for e, actor_name in result.all()]}

def _normalize_dt(dt):
    from datetime import datetime, timezone
    if not dt:
        return datetime.min.replace(tzinfo=timezone.utc)
    if isinstance(dt, datetime) and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.get("/{group_id}/ledger")
async def get_group_ledger(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return the complete group ledger (contributions + withdrawals), not just the current member's history."""
    try:
        membership = await db.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id, GroupMember.archived_at.is_(None)))
    except Exception:
        membership = await db.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id))

    if not membership:
        raise HTTPException(status_code=403, detail="Not an active member")
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get contributions (completed or pending) with eager-loaded user relationship
    contributions = (await db.execute(
        select(Contribution)
        .options(selectinload(Contribution.user))
        .where(Contribution.group_id == group_id, Contribution.status.in_(["completed", "pending"]))
        .order_by(Contribution.created_at.desc())
    )).scalars().all()
    
    # Get completed/disbursed withdrawals with eager-loaded requester relationship
    withdrawals = (await db.execute(
        select(Withdrawal)
        .options(selectinload(Withdrawal.requester))
        .where(Withdrawal.group_id == group_id, Withdrawal.status.in_(["disbursed", "completed", "approved"]))
        .order_by(Withdrawal.created_at.desc())
    )).scalars().all()
    
    # Combine and sort by date safely
    entries = []
    for c in contributions:
        m_name = (c.user.full_name if c.user and c.user.full_name else None)
        meta = c.meta_data if isinstance(c.meta_data, dict) else {}
        if not m_name and meta:
            m_name = meta.get("contributor_name") or meta.get("sender_name") or meta.get("payer_name")
        if not m_name:
            m_name = "Member"

        entries.append({
            "id": str(c.id),
            "type": "contribution",
            "amount": float(c.amount or 0),
            "status": c.status,
            "method": c.method or "momo",
            "reference": c.transaction_ref or f"CONT-{str(c.id)[:8]}",
            "created_at": c.created_at,
            "member_name": m_name,
            "is_guest": bool(meta.get("guest")) if meta else False,
            "contribution_frequency": meta.get("contribution_frequency") if meta else None
        })
    
    for w in withdrawals:
        req_name = (w.requester.full_name if w.requester and w.requester.full_name else "Member")
        entries.append({
            "id": str(w.id),
            "type": "withdrawal",
            "amount": float(w.amount or 0),
            "status": w.status,
            "method": w.disbursement_method or "momo",
            "reference": w.momo_disbursement_ref or f"WITH-{w.id.hex[:8].upper()}",
            "created_at": w.disbursed_at or w.created_at,
            "member_name": req_name,
            "requester_name": req_name,
            "beneficiary_name": w.beneficiary_name or req_name,
            "beneficiary_phone": w.beneficiary_phone
        })
    
    # Sort by created_at descending with normalized timezone
    entries.sort(key=lambda x: _normalize_dt(x["created_at"]), reverse=True)
    
    return {
        "group": {
            "id": str(group.id),
            "name": group.name,
            "code": group.code,
            "type": group.type,
            "balance": float(group.current_balance or 0),
            "target_amount": float(group.target_amount or 0)
        },
        "entries": entries
    }


@router.get("/{group_id}/ledger.pdf")
async def export_group_ledger_pdf(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Generate a downloadable financial statement for group admins and treasurers."""
    from io import BytesIO
    from datetime import datetime
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    
    try:
        member = await db.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
                GroupMember.role.in_(["admin", "treasurer"]),
                GroupMember.archived_at.is_(None)
            )
        )
    except Exception:
        member = await db.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == current_user.id,
                GroupMember.role.in_(["admin", "treasurer"])
            )
        )

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    if not member and group.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only admins and treasurers can export financial statements")

    contributions = (await db.execute(
        select(Contribution)
        .options(selectinload(Contribution.user))
        .where(Contribution.group_id == group_id, Contribution.status.in_(["completed", "pending"]))
    )).scalars().all()

    withdrawals = (await db.execute(
        select(Withdrawal)
        .options(selectinload(Withdrawal.requester))
        .where(Withdrawal.group_id == group_id, Withdrawal.status.in_(["disbursed", "completed", "approved"]))
    )).scalars().all()

    all_entries = []
    total_in = 0.0
    total_out = 0.0

    for c in contributions:
        amt = float(c.amount or 0)
        total_in += amt
        m_name = c.user.full_name if c.user and c.user.full_name else None
        meta = c.meta_data if isinstance(c.meta_data, dict) else {}
        if not m_name and meta:
            m_name = meta.get("contributor_name") or meta.get("sender_name") or meta.get("payer_name")
        if not m_name:
            m_name = "Member"
        all_entries.append({
            "date": c.created_at,
            "party": m_name,
            "type": "Contribution",
            "method": c.method or "momo",
            "amount": amt,
            "is_in": True
        })

    for w in withdrawals:
        amt = float(w.amount or 0)
        total_out += amt
        b_name = w.beneficiary_name or (w.requester.full_name if w.requester else "Member")
        all_entries.append({
            "date": w.disbursed_at or w.created_at,
            "party": f"To: {b_name[:25]}",
            "type": "Withdrawal",
            "method": w.disbursement_method or "momo",
            "amount": amt,
            "is_in": False
        })

    all_entries.sort(key=lambda x: _normalize_dt(x["date"]), reverse=False)

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 45

    # Title & Header
    pdf.setFont("Helvetica-Bold", 14)
    pdf.setFillColor(colors.HexColor("#065F46"))
    pdf.drawString(40, y, f"ADANSI FINANCIAL STATEMENT — {group.name.upper()}")
    y -= 20

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.HexColor("#4B5563"))
    pdf.drawString(40, y, f"Group Code: {group.code}  |  Type: {group.type.capitalize()}  |  Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    y -= 25

    # Summary Box
    pdf.setStrokeColor(colors.HexColor("#E5E7EB"))
    pdf.setFillColor(colors.HexColor("#F9FAFB"))
    pdf.rect(40, y - 35, width - 80, 40, fill=1, stroke=1)
    
    pdf.setFont("Helvetica-Bold", 9)
    pdf.setFillColor(colors.HexColor("#166534"))
    pdf.drawString(55, y - 22, f"Total In (Contributions): GHS {total_in:,.2f}")
    pdf.setFillColor(colors.HexColor("#991B1B"))
    pdf.drawString(230, y - 22, f"Total Out (Disbursements): GHS {total_out:,.2f}")
    pdf.setFillColor(colors.HexColor("#1E1B4B"))
    pdf.drawString(420, y - 22, f"Net Balance: GHS {(total_in - total_out):,.2f}")
    y -= 50

    # Table Header
    pdf.setFillColor(colors.HexColor("#F3F4F6"))
    pdf.rect(40, y - 16, width - 80, 20, fill=1, stroke=0)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.setFillColor(colors.HexColor("#374151"))
    pdf.drawString(45, y - 12, "Date")
    pdf.drawString(120, y - 12, "Party / Contributor")
    pdf.drawString(290, y - 12, "Type")
    pdf.drawString(370, y - 12, "Method")
    pdf.drawRightString(550, y - 12, "Amount (GHS)")
    y -= 24

    pdf.setFont("Helvetica", 9)
    for entry in all_entries:
        if y < 50:
            pdf.showPage()
            y = height - 45
            pdf.setFont("Helvetica-Bold", 9)
            pdf.setFillColor(colors.HexColor("#374151"))
            pdf.drawString(45, y - 12, "Date")
            pdf.drawString(120, y - 12, "Party / Contributor")
            pdf.drawString(290, y - 12, "Type")
            pdf.drawString(370, y - 12, "Method")
            pdf.drawRightString(550, y - 12, "Amount (GHS)")
            y -= 24
            pdf.setFont("Helvetica", 9)

        date_str = entry["date"].strftime("%Y-%m-%d") if entry["date"] else "-"
        pdf.setFillColor(colors.HexColor("#1F2937"))
        pdf.drawString(45, y, date_str)
        pdf.drawString(120, y, entry["party"][:30])
        pdf.drawString(290, y, entry["type"])
        pdf.drawString(370, y, entry["method"].upper())

        if entry["is_in"]:
            pdf.setFillColor(colors.HexColor("#166534"))
            pdf.drawRightString(550, y, f"+{entry['amount']:,.2f}")
        else:
            pdf.setFillColor(colors.HexColor("#991B1B"))
            pdf.drawRightString(550, y, f"-{entry['amount']:,.2f}")

        y -= 16

    pdf.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{group.code}-financial-statement.pdf"'})


@router.get("/{group_id}/join-requests")
async def get_join_requests(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    admin = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id, GroupMember.role.in_(["admin", "treasurer"]), GroupMember.archived_at.is_(None)))
    if not admin.scalar_one_or_none():
        return {"requests": []}
    result = await db.execute(select(JoinRequest).where(JoinRequest.group_id == group_id, JoinRequest.status == "pending"))
    return {"requests": [{"id": str(r.id), "user_id": str(r.user_id), "status": r.status, "created_at": r.requested_at} for r in result.scalars().all()]}

@router.post("/{group_id}/join-requests/{request_id}/review")
async def review_join_request(group_id: UUID, request_id: UUID, approved: bool, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    admin = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id, GroupMember.role == "admin"))
    if not admin.scalar_one_or_none(): raise HTTPException(status_code=403, detail="Only admins can review requests")
    result = await db.execute(select(JoinRequest).where(JoinRequest.id == request_id, JoinRequest.group_id == group_id))
    request = result.scalar_one_or_none()
    if not request or request.status != "pending": raise HTTPException(status_code=404, detail="Pending request not found")
    request.status = "approved" if approved else "rejected"; request.responded_by = current_user.id; request.responded_at = datetime.utcnow()
    if approved:
        db.add(GroupMember(group_id=group_id, user_id=request.user_id, role="member"))
        group = await db.get(Group, group_id)
        if group and group.rotation_enabled:
            queue = list(group.rotation_queue or [])
            queue.append({"user_id": str(request.user_id), "position": len(queue) + 1})
            group.rotation_queue = queue
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="join_approved" if approved else "join_rejected", entity_type="join_request", entity_id=request.id))
    await db.commit()
    return {"status": request.status}


@router.post("/join-by-code")
async def join_group_by_code(request: JoinGroupRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Join a group by short code — respects join_type approval rules."""
    group = await group_service.get_group_by_code(request.code)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    existing = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.user_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        return {"message": f"Already a member of {group.name}", "group_id": str(group.id), "status": "approved"}

    join_type = getattr(group, "join_type", "approval_required") or "approval_required"

    if join_type == "open":
        member = await group_service.join_group(group.id, current_user.id)
        return {"message": f"Joined {group.name} successfully", "group_id": str(group.id), "status": "approved"}

    if join_type == "invite_only":
        raise HTTPException(status_code=403, detail="This group is invite-only")

    jr = await db.scalar(select(JoinRequest).where(JoinRequest.group_id == group.id, JoinRequest.user_id == current_user.id, JoinRequest.status == "pending"))
    if jr:
        return {"message": "Join request already pending", "group_id": str(group.id), "status": "pending", "request_id": str(jr.id)}
    jr = JoinRequest(group_id=group.id, user_id=current_user.id)
    db.add(jr)
    await db.flush()
    db.add(AuditEvent(group_id=group.id, actor_id=current_user.id, event_type="join_requested", entity_type="join_request", entity_id=jr.id))
    await db.commit()
    return {"message": "Join request submitted", "group_id": str(group.id), "status": "pending", "request_id": str(jr.id)}


@router.post("/{group_id}/invite")
async def invite_member(
    group_id: UUID,
    request: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite a member via WhatsApp or SMS."""
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if request.phone:
        await notification_service.send_group_invite(
            phone=request.phone,
            inviter_name=current_user.full_name,
            group_name=group.name,
            group_code=group.code
        )

    return {"message": "Invite sent", "channel": request.channel, "group": group.name}


@router.post("/{group_id}/members/{user_id}/role")
async def update_member_role(
    group_id: UUID,
    user_id: UUID,
    role: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update member role (admin only)."""
    # Verify current user is admin
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == "admin"
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can change roles")

    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    )
    member = member.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if role not in {"admin", "treasurer", "member"}:
        raise HTTPException(status_code=400, detail="Role must be admin, treasurer, or member")

    if member.role == "admin" and role != "admin":
        admin_count = await db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id, GroupMember.role == "admin"))
        if (admin_count or 0) <= 1:
            raise HTTPException(status_code=400, detail="A group must always have at least one admin")

    member.role = role
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="member_role_updated", entity_type="group_member", entity_id=member.id, event_metadata={"target_user_id": str(user_id), "role": role}))
    await db.commit()
    return {"message": "Role updated", "user_id": str(user_id), "new_role": role}


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove member from group (admin only)."""
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == "admin"
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can remove members")

    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        )
    )
    member = member.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.role == "admin":
        admin_count = await db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id, GroupMember.role == "admin"))
        if (admin_count or 0) <= 1:
            raise HTTPException(status_code=400, detail="A group must always have at least one admin")

    await db.delete(member)
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="member_removed", entity_type="group_member", entity_id=member.id, event_metadata={"target_user_id": str(user_id)}))
    await db.commit()
    return {"message": "Member removed", "user_id": str(user_id)}


@router.post("/{group_id}/members/{user_id}/archive")
async def archive_member(group_id: UUID, user_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Archive membership without deleting contribution history."""
    admin = await db.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id, GroupMember.role == "admin", GroupMember.archived_at.is_(None)))
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can archive members")
    member = await db.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id, GroupMember.archived_at.is_(None)))
    if not member:
        raise HTTPException(status_code=404, detail="Active member not found")
    if member.role == "admin" and (await db.scalar(select(func.count()).select_from(GroupMember).where(GroupMember.group_id == group_id, GroupMember.role == "admin", GroupMember.archived_at.is_(None))) or 0) <= 1:
        raise HTTPException(status_code=400, detail="A group must always have an active admin")
    member.archived_at = datetime.utcnow()
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="member_archived", entity_type="group_member", entity_id=member.id, event_metadata={"target_user_id": str(user_id)}))
    await db.commit()
    return {"message": "Member archived", "user_id": str(user_id)}


@router.post("/{group_id}/members/{user_id}/unarchive")
async def unarchive_member(group_id: UUID, user_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Restore an archived member back to active status."""
    admin = await db.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id, GroupMember.role == "admin", GroupMember.archived_at.is_(None)))
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can restore archived members")
    member = await db.scalar(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id, GroupMember.archived_at.is_not(None)))
    if not member:
        raise HTTPException(status_code=404, detail="Archived member not found")
    member.archived_at = None
    db.add(AuditEvent(group_id=group_id, actor_id=current_user.id, event_type="member_restored", entity_type="group_member", entity_id=member.id, event_metadata={"target_user_id": str(user_id)}))
    await db.commit()
    return {"message": "Member restored", "user_id": str(user_id)}


@router.get("/{group_id}/balance")
async def get_group_balance(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get real-time group balance."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Keep the balance source-of-truth aligned with the contribution/withdrawal ledger.
    try:
        current_balance = await group_service.reconcile_group_balance(db, group_id)
    except ValueError:
        current_balance = group.current_balance

    member_result = await db.execute(
        select(func.sum(Contribution.amount)).where(
            Contribution.group_id == group_id,
            Contribution.user_id == current_user.id,
            Contribution.status == "completed"
        )
    )
    my_contribution = member_result.scalar() or 0

    return {
        "group_id": str(group_id),
        "group_name": group.name,
        "balance": float(current_balance),
        "my_contribution": float(my_contribution),
        "target_amount": float(group.target_amount) if group.target_amount else None,
        "member_count": len(group.members)
    }


@router.post("/{group_id}/reconcile")
async def reconcile_group_balance(group_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Recalculate the group balance from the ledger and store the result."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    try:
        balance = await group_service.reconcile_group_balance(db, group_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Group not found")

    await db.commit()
    return {"group_id": str(group_id), "balance": float(balance)}


@router.get("/{group_id}/contributions")
async def get_group_contributions(
    group_id: UUID,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Paginated list of group contributions with contributor names for the activity feed."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    result = await db.execute(
        select(Contribution)
        .options(selectinload(Contribution.user))
        .where(Contribution.group_id == group_id)
        .order_by(Contribution.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    contributions = result.scalars().all()

    items = []
    for c in contributions:
        c_name = (c.user.full_name if c.user and c.user.full_name else None)
        if not c_name and c.meta_data:
            c_name = c.meta_data.get("contributor_name") or c.meta_data.get("sender_name") or c.meta_data.get("payer_name")
        if not c_name:
            c_name = "Member"
        items.append({
            "id": str(c.id),
            "amount": float(c.amount),
            "status": c.status,
            "method": c.method,
            "transaction_ref": c.transaction_ref,
            "created_at": c.created_at,
            "contributor_name": c_name,
            "contribution_frequency": c.meta_data.get("contribution_frequency") if c.meta_data else None,
        })

    return {"contributions": items, "count": len(items)}


@router.get("/{group_id}/withdrawals")
async def get_group_withdrawals(
    group_id: UUID,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Paginated list of group withdrawals."""
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    from app.models import Withdrawal
    result = await db.execute(
        select(Withdrawal)
        .where(Withdrawal.group_id == group_id)
        .order_by(Withdrawal.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    withdrawals = result.scalars().all()
    return {"withdrawals": withdrawals, "count": len(withdrawals)}
