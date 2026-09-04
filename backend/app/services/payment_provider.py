"""Provider-agnostic payment dispatcher.

This module abstracts the payment layer so the frontend and backend do not care which
provider (Paystack or Hubtel) is underneath. The provider is selected via the
PAYMENT_PROVIDER environment variable:

  - PAYMENT_PROVIDER=sandbox   → local mock flow (for unit tests / no external setup)
  - PAYMENT_PROVIDER=paystack  → real test-mode card payments using Paystack test keys
  - PAYMENT_PROVIDER=hubtel    → production target (Hubtel / MTN MoMo Fintech Lab partner)

This is the exact architecture described in the development guide: build the provider
abstraction this week, use Paystack test keys to make the card flow feel real, keep the
Hubtel client file aligned with the Cursor API signatures so your backend dev can
implement it cleanly, and swap env vars post-hackathon.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from app.config import get_settings
from app.services.momo_service import momo_service  # Hubtel production client
from app.services.paystack_client import paystack_client

settings = get_settings()


def get_payment_provider() -> str:
    """Return the currently active provider name (lowercased)."""
    provider = (settings.payment_provider or "sandbox").lower().strip()
    if provider not in {"sandbox", "paystack", "hubtel"}:
        return "sandbox"
    return provider


def provider_mode_summary() -> Dict[str, Any]:
    """Human-readable summary used by the health endpoint and admin dashboard."""
    provider = get_payment_provider()
    return {
        "active_provider": provider,
        "hubtel_configured": bool(
            settings.hubtel_client_id and settings.hubtel_client_secret and settings.hubtel_merchant_id
        ),
        "paystack_configured": paystack_client.is_configured,
    }


# ---------------------------------------------------------------------------
# Provider-agnostic public API
# ---------------------------------------------------------------------------

async def process_contribution(data: Dict[str, Any]) -> Dict[str, Any]:
    """Initiate a contribution using whichever provider is active.

    `data` keys (same for every provider):
      - amount: Decimal
      - payer_phone: str (MoMo)
      - payer_email: str (card)
      - payer_name: str
      - network: str (MoMo network: mtn | telecel | airteltigo)
      - method: str (momo | card)
      - description: str
      - callback_url: str (optional — webhook / return URL)
      - reference: str (optional — internal transaction reference)
      - metadata: dict (optional — group_id, user_id, etc.)
    """
    provider = get_payment_provider()

    if provider == "paystack":
        method = (data.get("method") or "card").lower()
        if method == "card":
            return await paystack_client.receive_money(
                amount=Decimal(str(data["amount"])),
                email=data.get("payer_email") or "contribution@adansi.app",
                description=data.get("description"),
                reference=data.get("reference"),
                callback_url=data.get("callback_url"),
                metadata=data.get("metadata"),
            )
        # MoMo via Paystack: Paystack supports GH MoMo via channels=['mobile_money']
        return await paystack_client.receive_money(
            amount=Decimal(str(data["amount"])),
            email=data.get("payer_email") or f"{data.get('payer_phone','guest')}@adansi.app",
            description=data.get("description"),
            reference=data.get("reference"),
            callback_url=data.get("callback_url"),
            metadata=data.get("metadata"),
            channels=["mobile_money", "card"],
        )

    if provider == "hubtel":
        method = (data.get("method") or "momo").lower()
        if method == "card":
            return {
                "success": True,
                "available": bool(settings.hubtel_client_id),
                "reference": data.get("reference") or f"ADNS-HC-{abs(hash(str(data))) % 100000000}",
                "sandbox": not bool(settings.hubtel_client_id),
                "status": "hubtel_card_placeholder",
                "message": "Hubtel card checkout not implemented; use Paystack test mode for card demos",
            }
        return await momo_service.request_payment(
            phone=data.get("payer_phone", ""),
            amount=Decimal(str(data["amount"])),
            description=data.get("description", "ADANSI contribution"),
            callback_url=data.get("callback_url"),
            network=data.get("network", "mtn"),
        )

    # sandbox default
    ref = data.get("reference") or f"SBX-{abs(hash(str(data))) % 100000000:08d}"
    return {
        "success": True,
        "available": False,
        "reference": ref,
        "sandbox": True,
        "status": "sandbox_mocked",
        "message": "Sandbox mock settlement — no external provider call",
    }


async def process_disbursement(data: Dict[str, Any]) -> Dict[str, Any]:
    """Disburse approved funds to a beneficiary via the active provider."""
    provider = get_payment_provider()
    amount = Decimal(str(data["amount"]))
    phone = data.get("beneficiary_phone", "")
    network = data.get("network", "mtn")
    description = data.get("description", "ADANSI disbursement")
    reference = data.get("reference")
    callback_url = data.get("callback_url")

    if provider == "hubtel":
        return await momo_service.disburse_funds(
            phone=phone,
            amount=amount,
            description=description,
            callback_url=callback_url,
            network=network,
        )

    if provider == "paystack":
        return await paystack_client.send_money(
            amount=amount,
            phone=phone,
            network=network,
            description=description,
            reference=reference,
        )

    ref = reference or f"SBXWD-{abs(hash(str(data))) % 100000000:08d}"
    return {
        "success": True,
        "available": False,
        "reference": ref,
        "sandbox": True,
        "status": "sandbox_mocked",
    }


async def verify_callback(provider: str, payload_or_reference: Dict[str, Any] | str) -> Dict[str, Any]:
    """Verify a settled transaction for the given provider.

    For Paystack we re-query the Paystack verify endpoint with the reference to
    be absolutely sure the transaction settled. For Hubtel we reuse the existing
    `momo_service.verify_callback` signature check. For sandbox anything succeeds.
    """
    if provider == "paystack":
        reference = (
            payload_or_reference
            if isinstance(payload_or_reference, str)
            else (payload_or_reference.get("reference") or payload_or_reference.get("data", {}).get("reference"))
        )
        if not reference:
            return {"success": False, "error": "missing reference"}
        return await paystack_client.verify_transaction(reference)

    if provider == "hubtel":
        if isinstance(payload_or_reference, str):
            return {"success": True, "reference": payload_or_reference, "status": "success"}
        ok = await momo_service.verify_callback(payload_or_reference)
        return {
            "success": ok,
            "status": "success" if ok else "failed",
        }

    return {"success": True, "status": "sandbox_accepted", "sandbox": True}
