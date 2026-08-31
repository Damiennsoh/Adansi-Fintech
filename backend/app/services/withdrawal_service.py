"""Withdrawal approval rules and direct beneficiary disbursement."""
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Withdrawal, Group, GroupMember, User, Transaction, AuditEvent
from app.services.momo_service import momo_service
from app.services.notification_service import notification_service

GHANA_PHONE_PATTERN = re.compile(r"^\+233(20|24|50|54|55|26|56|57|27|59)\d{7}$")

NETWORK_CHANNELS = {
    "mtn": "mtn-gh",
    "telecel": "vodafone-gh",
    "airteltigo": "tigo-gh",
}


def validate_ghana_phone(phone: str) -> bool:
    return bool(GHANA_PHONE_PATTERN.match(phone))


def detect_network(phone: str) -> str:
    if len(phone) < 6:
        return "mtn"
    prefix = phone[4:6]
    if prefix in ("20", "24", "54", "55", "59"):
        return "mtn"
    if prefix == "50":
        return "telecel"
    if prefix in ("26", "56", "57", "27"):
        return "airteltigo"
    return "mtn"


def calculate_required_approvals(group: Group) -> int:
    """Return how many approvals are needed based on group approval_rule."""
    treasurers = [m for m in group.members if m.role in ("admin", "treasurer", "creator")]
    members = group.members
    rule = group.approval_rule or "any_1_treasurer"

    if rule == "two_of_three_treasurers":
        return min(2, max(1, len(treasurers)))
    if rule == "majority_members":
        return max(2, int(len(members) * 0.51))
    if rule == "unanimous_members":
        return max(1, len(members))
    return 1


async def execute_disbursement(
    withdrawal: Withdrawal,
    group: Group,
    actor_id: UUID,
    db: AsyncSession,
) -> dict:
    """Disburse funds directly to beneficiary (never to requester)."""
    if withdrawal.status == "disbursed" and withdrawal.momo_disbursement_ref:
        return {"success": True, "reference": withdrawal.momo_disbursement_ref, "beneficiary": withdrawal.beneficiary_name or withdrawal.beneficiary_phone, "status": "disbursed", "already_processed": True}
    if not withdrawal.beneficiary_phone:
        return {"success": False, "error": "Beneficiary phone is required"}

    if withdrawal.disbursement_method == "momo" and not validate_ghana_phone(withdrawal.beneficiary_phone):
        return {"success": False, "error": "Invalid beneficiary phone number"}

    if group.current_balance < withdrawal.amount:
        return {"success": False, "error": "Insufficient group balance"}

    network = withdrawal.beneficiary_network or detect_network(withdrawal.beneficiary_phone)
    description = withdrawal.reason or f"ADANSI withdrawal from {group.name}"

    if withdrawal.disbursement_method == "bank_transfer":
        # Bank transfer stub — use MoMo fallback for MVP sandbox
        result = await momo_service.disburse_funds(
            phone=withdrawal.beneficiary_phone,
            amount=withdrawal.amount,
            description=description,
            network=network,
        )
    else:
        result = await momo_service.disburse_funds(
            phone=withdrawal.beneficiary_phone,
            amount=withdrawal.amount,
            description=description,
            network=network,
        )

    if not result["success"]:
        return {"success": False, "error": result.get("hubtel_response", "Disbursement failed")}

    withdrawal.status = "disbursed"
    withdrawal.disbursed_at = datetime.utcnow()
    withdrawal.approved_at = withdrawal.approved_at or datetime.utcnow()
    withdrawal.momo_disbursement_ref = result["reference"]
    group.current_balance -= withdrawal.amount

    transaction = Transaction(
        type="withdrawal",
        reference=result["reference"],
        amount=withdrawal.amount,
        group_id=withdrawal.group_id,
        user_id=actor_id,
        status="completed",
        external_ref=result["reference"],
    )
    db.add(transaction)
    db.add(
        AuditEvent(
            group_id=withdrawal.group_id,
            actor_id=actor_id,
            event_type="withdrawal_disbursed",
            entity_type="withdrawal",
            entity_id=withdrawal.id,
            amount=withdrawal.amount,
            event_metadata={
                "reference": result["reference"],
                "beneficiary_name": withdrawal.beneficiary_name,
                "beneficiary_phone": withdrawal.beneficiary_phone,
                "beneficiary_network": network,
            },
        )
    )

    await db.commit()

    beneficiary_label = withdrawal.beneficiary_name or withdrawal.beneficiary_phone
    for member in group.members:
        user = await db.get(User, member.user_id)
        if user:
            await notification_service.send_withdrawal_completed(
                phone=user.phone,
                amount=float(withdrawal.amount),
                group_name=group.name,
                agent_id=beneficiary_label,
            )

    return {
        "success": True,
        "reference": result["reference"],
        "beneficiary": beneficiary_label,
        "status": "disbursed",
    }


def withdrawal_expires_at(group: Group) -> datetime:
    hours = group.approval_timeout_hours or 24
    return datetime.utcnow() + timedelta(hours=hours)
