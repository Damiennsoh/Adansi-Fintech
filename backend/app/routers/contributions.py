"""Contribution endpoints with full CRUD, provider abstraction, and webhook handling."""
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from decimal import Decimal
import json

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.momo_service import momo_service
from app.services.credit_service import credit_engine
from app.services.notification_service import notification_service
from app.services.payment_provider import (
    process_contribution,
    get_payment_provider,
    verify_callback as provider_verify_callback,
    provider_mode_summary,
)
from app.services.paystack_client import paystack_client
from app.schemas.contribution import ContributionCreateRequest, ContributionResponse, MomoCallbackPayload
from app.models import Contribution, Group, GroupMember, User, Transaction, AuditEvent
from app.services.history_service import mark_contribution_on_schedule, ensure_schedules_for_member
from app.services.group_service import group_service
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/contributions", tags=["Contributions"])


@router.get("/provider/info")
def provider_info():
    """Return currently active payment provider + feature flags (used by frontend)."""
    summary = provider_mode_summary()
    return {
        **summary,
        "paystack_public_key": settings.paystack_test_public_key,
        "note": (
            "Paystack powers card payment testing. "
            "Demo Day judges see Hubtel-integrated MoMo + Paystack card (provider-agnostic architecture)."
        ),
    }


async def settle_contribution(db: AsyncSession, contribution: Contribution, actor_id=None, provider: str = "sandbox", external_ref: str | None = None):
    """Post one completed contribution to every financial source of truth."""
    if await db.scalar(select(Transaction).where(Transaction.reference == contribution.transaction_ref)):
        return
    contribution.status = "completed"
    contribution.momo_transaction_id = external_ref or contribution.momo_transaction_id
    group = await db.get(Group, contribution.group_id)
    if group:
        await group_service.reconcile_group_balance(db, contribution.group_id)
    member = await db.scalar(select(GroupMember).where(GroupMember.group_id == contribution.group_id, GroupMember.user_id == contribution.user_id))
    if member:
        member.total_contributed += contribution.amount
        member.last_contribution_at = contribution.created_at
    user = await db.get(User, contribution.user_id)
    if user:
        user.total_contributed += contribution.amount
    db.add(Transaction(type="contribution", reference=contribution.transaction_ref, amount=contribution.amount, group_id=contribution.group_id, user_id=contribution.user_id, status="completed", external_ref=external_ref or contribution.transaction_ref))
    db.add(AuditEvent(group_id=contribution.group_id, actor_id=actor_id, event_type="contribution_settled", entity_type="contribution", entity_id=contribution.id, amount=contribution.amount, event_metadata={"reference": contribution.transaction_ref, "method": contribution.method, "provider": provider}))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contribution(
    request: ContributionCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Initiate contribution. Creates pending record + calls MoMo API."""
    # Verify user is group member
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == request.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    group = await db.get(Group, request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Create pending contribution record
    contribution = Contribution(
        group_id=request.group_id,
        user_id=current_user.id,
        amount=request.amount,
        method=request.method,
        status="pending",
        meta_data={
            "network": request.network,
            "payer_name": request.payer_name or current_user.full_name,
            "method": request.method,
        },
    )
    db.add(contribution)
    await db.flush()  # Get ID without committing

    # Generate transaction reference
    transaction_ref = f"ADNS-CONT-{contribution.id.hex[:8].upper()}"
    contribution.transaction_ref = transaction_ref
    await db.commit()
    await db.refresh(contribution)

    active_provider = get_payment_provider()
    public_callback = (settings.api_public_url or "").rstrip("/") + "/api/v1/contributions/webhook/paystack"

    provider_data = {
        "amount": request.amount,
        "payer_phone": request.payer_phone or current_user.phone,
        "payer_email": request.payer_email or getattr(current_user, "email", None) or f"user-{current_user.id}@adansi.app",
        "payer_name": request.payer_name or current_user.full_name,
        "network": request.network,
        "method": request.method,
        "description": f"ADANSI contribution to {group.name}",
        "reference": transaction_ref,
        "callback_url": public_callback if request.method == "card" else None,
        "metadata": {
            "contribution_id": str(contribution.id),
            "group_id": str(request.group_id),
            "user_id": str(current_user.id),
            "group_name": group.name,
            "payer_name": request.payer_name or current_user.full_name,
        },
    }
    result = await process_contribution(provider_data)

    if not result["success"]:
        contribution.status = "failed"
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Payment provider ({active_provider}) failed: {result.get('error') or result.get('message')}")

    if result.get("sandbox"):
        await settle_contribution(db, contribution, current_user.id, provider=active_provider, external_ref=result.get("reference"))
        if group and group.contribution_amount and group.contribution_frequency:
            await ensure_schedules_for_member(db, contribution.group_id, contribution.user_id, group.contribution_amount, group.contribution_frequency)
        await mark_contribution_on_schedule(db, contribution)
        background_tasks.add_task(credit_engine.calculate_score, contribution.user_id)
        await db.commit()
        return {
            "message": "Payment completed in local sandbox",
            "contribution_id": str(contribution.id),
            "transaction_ref": transaction_ref,
            "amount": float(request.amount),
            "status": "completed",
            "sandbox": True,
            "provider": active_provider,
        }

    if request.method == "card" and result.get("authorization_url"):
        return {
            "message": "Card checkout initialized — redirect user to Paystack hosted page",
            "contribution_id": str(contribution.id),
            "transaction_ref": result.get("reference") or transaction_ref,
            "amount": float(request.amount),
            "status": "pending",
            "provider": active_provider,
            "authorization_url": result.get("authorization_url"),
            "access_code": result.get("access_code"),
        }

    return {
        "message": "Payment request initiated",
        "contribution_id": str(contribution.id),
        "transaction_ref": result.get("reference") or transaction_ref,
        "amount": float(request.amount),
        "status": "pending",
        "provider": active_provider,
        "instructions": "Please confirm the payment prompt on your phone.",
    }


async def ensure_guest_user(db: AsyncSession, payer_name: str | None) -> User:
    """Create a lightweight guest user for public one-time contributions without creating a group membership."""
    guest_name = (payer_name or "Guest Contributor").strip() or "Guest Contributor"
    result = await db.execute(
        select(User).where(User.full_name == guest_name).order_by(User.created_at.desc()).limit(1)
    )
    guest = result.scalar_one_or_none()
    if guest:
        return guest

    guest = User(full_name=guest_name, role="user", is_active=True)
    db.add(guest)
    await db.flush()
    return guest


@router.post("/guest", status_code=status.HTTP_201_CREATED)
async def create_guest_contribution(
    request: ContributionCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a contribution from a public guest link without creating a group membership."""
    group = await db.get(Group, request.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    guest_user = await ensure_guest_user(db, request.payer_name)
    if request.method == "momo" and not request.payer_phone:
        raise HTTPException(status_code=400, detail="A MoMo number is required")

    contribution = Contribution(
        group_id=request.group_id,
        user_id=guest_user.id,
        amount=request.amount,
        method=request.method,
        status="pending",
        meta_data={
            "network": request.network,
            "payer_name": request.payer_name or guest_user.full_name,
            "guest": True,
            "method": request.method,
            "payer_phone": request.payer_phone,
        },
    )
    db.add(contribution)
    await db.flush()

    transaction_ref = f"ADNS-GUEST-{contribution.id.hex[:8].upper()}"
    contribution.transaction_ref = transaction_ref

    active_provider = get_payment_provider()
    public_callback = (settings.api_public_url or "").rstrip("/") + "/api/v1/contributions/webhook/paystack"
    provider_data = {
        "amount": request.amount,
        "payer_phone": request.payer_phone or getattr(guest_user, "phone"),
        "payer_email": getattr(guest_user, "email") or f"guest-{guest_user.id}@adansi.app",
        "payer_name": request.payer_name or guest_user.full_name,
        "network": request.network,
        "method": request.method,
        "description": f"ADANSI guest contribution to {group.name}",
        "reference": transaction_ref,
        "callback_url": public_callback if request.method == "card" else None,
        "metadata": {
            "contribution_id": str(contribution.id),
            "group_id": str(request.group_id),
            "user_id": str(guest_user.id),
            "group_name": group.name,
            "guest": True,
            "payer_name": request.payer_name or guest_user.full_name,
        },
    }
    if request.method == "card":
        provider_result = await process_contribution(provider_data)
        if not provider_result["success"]:
            contribution.status = "failed"
            await db.commit()
            raise HTTPException(status_code=502, detail=f"Card payment init failed: {provider_result.get('error') or 'Provider error'}")
        contribution.transaction_ref = provider_result.get("reference") or transaction_ref
        if provider_result.get("sandbox"):
            await settle_contribution(db, contribution, provider=active_provider, external_ref=provider_result.get("reference"))
    elif request.method == "momo":
        provider_result = await process_contribution(provider_data)
        if not provider_result["success"]:
            contribution.status = "failed"
            await db.commit()
            raise HTTPException(status_code=502, detail="MoMo payment request failed")
        contribution.transaction_ref = provider_result.get("reference") or transaction_ref
        if provider_result.get("sandbox"):
            await settle_contribution(db, contribution, provider=active_provider, external_ref=provider_result.get("reference"))

    await db.commit()
    await db.refresh(contribution)

    response_body = {
        "message": "Contribution recorded",
        "contribution_id": str(contribution.id),
        "transaction_ref": contribution.transaction_ref,
        "amount": float(request.amount),
        "status": contribution.status,
        "guest": True,
        "provider": active_provider,
    }
    if request.method == "card" and provider_result and provider_result.get("authorization_url"):
        response_body["authorization_url"] = provider_result["authorization_url"]
        response_body["access_code"] = provider_result.get("access_code")
    return response_body


@router.get("/{contribution_id}")
async def get_contribution(contribution_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get contribution details and status."""
    contribution = await db.get(Contribution, contribution_id)
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    # Verify user can see this (member of group)
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == contribution.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    return contribution


@router.post("/{contribution_id}/verify")
async def verify_contribution(
    contribution_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually verify a pending contribution (admin/treasurer)."""
    contribution = await db.scalar(select(Contribution).where(Contribution.id == contribution_id).with_for_update())
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")

    # Verify admin/treasurer role
    role_check = await db.execute(
        select(GroupMember.role).where(
            GroupMember.group_id == contribution.group_id,
            GroupMember.user_id == current_user.id
        )
    )
    role = role_check.scalar_one_or_none()
    if role not in ["admin", "treasurer"]:
        raise HTTPException(status_code=403, detail="Only admins or treasurers can verify")

    if contribution.status != "pending":
        raise HTTPException(status_code=400, detail=f"Contribution is already {contribution.status}")

    # Idempotency guard: a completed transaction can never be posted twice.
    existing_transaction = await db.scalar(select(Transaction).where(Transaction.reference == contribution.transaction_ref))
    if existing_transaction:
        return {"message": "Contribution already settled", "contribution_id": str(contribution_id), "status": "completed"}

    # Mark as completed
    contribution.status = "completed"

    # Reconcile the group balance from actual ledger totals
    group = await db.get(Group, contribution.group_id)
    if group:
        await group_service.reconcile_group_balance(db, contribution.group_id)

    # Update member totals
    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == contribution.group_id,
            GroupMember.user_id == contribution.user_id
        )
    )
    member = member.scalar_one_or_none()
    if member:
        member.total_contributed += contribution.amount
        member.last_contribution_at = contribution.created_at

    if group and group.contribution_amount and group.contribution_frequency:
        await ensure_schedules_for_member(
            db, contribution.group_id, contribution.user_id,
            group.contribution_amount, group.contribution_frequency,
        )
    await mark_contribution_on_schedule(db, contribution)

    # Update user totals
    user = await db.get(User, contribution.user_id)
    user.total_contributed += contribution.amount

    # Create audit transaction
    transaction = Transaction(
        type="contribution",
        reference=contribution.transaction_ref,
        amount=contribution.amount,
        group_id=contribution.group_id,
        user_id=contribution.user_id,
        status="completed",
        external_ref=contribution.momo_transaction_id
    )
    db.add(transaction)
    db.add(AuditEvent(group_id=contribution.group_id, actor_id=current_user.id, event_type="contribution_settled", entity_type="contribution", entity_id=contribution.id, amount=contribution.amount, event_metadata={"reference": contribution.transaction_ref, "method": contribution.method}))

    await db.commit()

    # Trigger async credit score update
    await credit_engine.calculate_score(contribution.user_id)

    return {"message": "Contribution verified and completed", "contribution_id": str(contribution_id)}


@router.post("/webhook/hubtel")
async def hubtel_callback(
    payload: MomoCallbackPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Hubtel payment callback webhook. Processes async payment confirmations."""
    is_valid = await momo_service.verify_callback(payload.model_dump())
    if not is_valid:
        return {"status": "ignored", "reason": "Invalid callback signature or response code"}

    data = payload.Data
    client_ref = data.get("ClientReference")
    transaction_id = data.get("TransactionId")
    amount = Decimal(str(data.get("Amount", 0)))
    phone = data.get("CustomerMsisdn")
    status = data.get("Status", "").lower()

    if not client_ref:
        return {"status": "ignored", "reason": "Missing ClientReference"}

    # Find contribution by reference
    result = await db.execute(
        select(Contribution).where(Contribution.transaction_ref == client_ref).with_for_update()
    )
    contribution = result.scalar_one_or_none()

    if not contribution:
        return {"status": "ignored", "reason": "Contribution not found"}

    existing_transaction = await db.scalar(select(Transaction).where(Transaction.reference == client_ref))
    if contribution.status != "pending" or existing_transaction:
        return {"status": "ignored", "reason": "Already processed"}
    if status == "success" and amount != Decimal(str(contribution.amount)):
        contribution.status = "failed"
        await db.commit()
        return {"status": "ignored", "reason": "Callback amount mismatch"}

    if status == "success":
        contribution.status = "completed"
        contribution.momo_transaction_id = transaction_id

        # Reconcile the group balance from actual ledger totals
        group = await db.get(Group, contribution.group_id)
        if group:
            await group_service.reconcile_group_balance(db, contribution.group_id)

        # Update member totals
        member = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == contribution.group_id,
                GroupMember.user_id == contribution.user_id
            )
        )
        member = member.scalar_one_or_none()
        if member:
            member.total_contributed += contribution.amount
            member.last_contribution_at = contribution.created_at

        if group and group.contribution_amount and group.contribution_frequency:
            await ensure_schedules_for_member(
                db, contribution.group_id, contribution.user_id,
                group.contribution_amount, group.contribution_frequency,
            )
        await mark_contribution_on_schedule(db, contribution)

        # Update user totals
        user = await db.get(User, contribution.user_id)
        user.total_contributed += contribution.amount

        # Create audit transaction
        transaction = Transaction(
            type="contribution",
            reference=client_ref,
            amount=amount,
            group_id=contribution.group_id,
            user_id=contribution.user_id,
            status="completed",
            external_ref=transaction_id
        )
        db.add(transaction)
        db.add(AuditEvent(group_id=contribution.group_id, actor_id=None, event_type="contribution_settled", entity_type="contribution", entity_id=contribution.id, amount=contribution.amount, event_metadata={"reference": client_ref, "provider": "hubtel", "external_ref": transaction_id}))

        await db.commit()

        # Send notification to group members
        await notification_service.send_contribution_alert(
            phone=user.phone,
            contributor_name=user.full_name,
            amount=float(amount),
            group_name=group.name,
            new_balance=float(group.current_balance)
        )

        # Recalculate credit score
        await credit_engine.calculate_score(contribution.user_id)

        return {"status": "processed", "contribution_id": str(contribution.id), "result": "completed"}

    else:
        # Payment failed
        contribution.status = "failed"
        await db.commit()
        return {"status": "processed", "contribution_id": str(contribution.id), "result": "failed", "reason": data.get("Message")}


async def _settle_from_callback(
    db: AsyncSession,
    contribution: Contribution,
    external_ref: str,
    amount: Decimal,
    provider: str,
):
    """Shared settlement logic used by Paystack/Hubtel webhooks and the verify endpoint."""
    group = await db.get(Group, contribution.group_id)
    if group:
        await group_service.reconcile_group_balance(db, contribution.group_id)
    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == contribution.group_id,
            GroupMember.user_id == contribution.user_id,
        )
    )
    member = member.scalar_one_or_none()
    if member:
        member.total_contributed += contribution.amount
        member.last_contribution_at = contribution.created_at
    if group and group.contribution_amount and group.contribution_frequency:
        await ensure_schedules_for_member(
            db, contribution.group_id, contribution.user_id,
            group.contribution_amount, group.contribution_frequency,
        )
    await mark_contribution_on_schedule(db, contribution)
    user = await db.get(User, contribution.user_id)
    if user:
        user.total_contributed += contribution.amount
    db.add(Transaction(
        type="contribution",
        reference=contribution.transaction_ref,
        amount=amount,
        group_id=contribution.group_id,
        user_id=contribution.user_id,
        status="completed",
        external_ref=external_ref,
    ))
    db.add(AuditEvent(
        group_id=contribution.group_id,
        actor_id=None,
        event_type="contribution_settled",
        entity_type="contribution",
        entity_id=contribution.id,
        amount=contribution.amount,
        event_metadata={
            "reference": contribution.transaction_ref,
            "provider": provider,
            "external_ref": external_ref,
        },
    ))
    await db.commit()
    if user:
        user_phone = user.phone or "+233240000000"
        if notification_service.is_configured:
            await notification_service.send_contribution_alert(
                phone=user_phone,
                contributor_name=user.full_name,
                amount=float(amount),
                group_name=group.name if group else "your group",
                new_balance=float(group.current_balance) if group else 0.0,
            )
        await credit_engine.calculate_score(contribution.user_id)


@router.get("/verify/paystack/{reference}")
async def verify_paystack_transaction(
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    """Poll Paystack to confirm a transaction settled, then settle our ledger.

    The frontend calls this after the Paystack popup returns successfully — it is
    idempotent so multiple retries from the UI never double-post a contribution.
    """
    contribution = await db.scalar(
        select(Contribution).where(
            (Contribution.transaction_ref == reference)
        ).with_for_update()
    )
    if not contribution:
        return {"status": "ignored", "reason": "Contribution not found", "reference": reference}
    existing = await db.scalar(select(Transaction).where(Transaction.reference == contribution.transaction_ref))
    if contribution.status == "completed" and existing:
        return {"status": "already_processed", "contribution_id": str(contribution.id), "amount": float(contribution.amount)}

    verification = await provider_verify_callback("paystack", reference)
    if not verification.get("success"):
        contribution.status = "failed"
        await db.commit()
        return {"status": "failed", "reason": verification.get("error") or "Paystack verification failed"}

    settled_status = str(verification.get("status") or "unknown").lower()
    if settled_status not in {"success", "completed"}:
        contribution.status = "pending"
        await db.commit()
        return {"status": "pending", "reason": f"Paystack reports '{settled_status}'"}

    amount = verification.get("amount") or contribution.amount
    contribution.status = "completed"
    contribution.momo_transaction_id = (
        verification.get("paystack_transaction_id") or verification.get("reference") or reference
    )
    await _settle_from_callback(
        db,
        contribution,
        external_ref=verification.get("paystack_transaction_id") or reference,
        amount=Decimal(str(amount)),
        provider="paystack",
    )
    return {
        "status": "processed",
        "contribution_id": str(contribution.id),
        "result": "completed",
        "amount": float(amount),
        "provider": "paystack",
    }


@router.post("/webhook/paystack")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str | None = Header(default=None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """Paystack webhook for charge.success events.

    Authenticity is verified via HMAC-SHA512 of the raw body signed with the secret key.
    Falls back to the client-side /verify/paystack/{ref} result when the secret key is
    not fully configured in local dev.
    """
    raw = await request.body()
    signature_ok = paystack_client.verify_webhook_signature(raw, x_paystack_signature)
    if not signature_ok and paystack_client.is_configured:
        return {"status": "ignored", "reason": "Invalid Paystack webhook signature"}
    try:
        event = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        return {"status": "ignored", "reason": "Invalid JSON body"}
    event_type = event.get("event", "")
    data = event.get("data") or {}
    reference = data.get("reference") or event.get("reference")
    if not reference:
        return {"status": "ignored", "reason": "Missing reference"}
    if event_type and event_type not in {"charge.success", "transfer.success"}:
        return {"status": "ignored", "event_type": event_type, "reference": reference}

    contribution = await db.scalar(
        select(Contribution).where(
            (Contribution.transaction_ref == reference)
        ).with_for_update()
    )
    if not contribution:
        return {"status": "ignored", "reason": "Contribution not found", "reference": reference}
    existing = await db.scalar(select(Transaction).where(Transaction.reference == contribution.transaction_ref))
    if contribution.status == "completed" and existing:
        return {"status": "already_processed", "reference": reference}

    amount = Decimal(str(data.get("amount", 0)))
    if amount and data.get("currency"):
        amount = amount / Decimal("100")
    if not amount:
        amount = contribution.amount
    external_ref = str(data.get("id") or reference)

    contribution.status = "completed"
    contribution.momo_transaction_id = external_ref
    await _settle_from_callback(
        db,
        contribution,
        external_ref=external_ref,
        amount=amount,
        provider="paystack",
    )
    return {"status": "processed", "reference": reference, "provider": "paystack"}

