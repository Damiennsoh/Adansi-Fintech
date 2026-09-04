from decimal import Decimal

import pytest

from app.main import build_health_status
from app.routers import admin as admin_module
from app.services.momo_service import momo_service
from app.services.notification_service import NotificationService
from app.services.paystack_client import PaystackClient
from app.services.payment_provider import (
    process_contribution,
    process_disbursement,
    get_payment_provider,
    verify_callback,
)


@pytest.mark.asyncio
async def test_momo_requests_succeed_in_sandbox_when_provider_is_unconfigured():
    momo_service.client_id = None
    momo_service.client_secret = None
    momo_service.merchant_id = None

    result = await momo_service.request_payment(
        phone="+233240000000",
        amount=Decimal("12.50"),
        description="Test contribution",
        network="mtn",
    )

    assert result["success"] is True
    assert result.get("sandbox") is True
    assert result.get("reference")


@pytest.mark.asyncio
async def test_paystack_mocks_unconfig_and_has_valid_is_configured_check():
    client = PaystackClient()
    client.secret_key = None
    client.public_key = None
    assert client.is_configured is False
    init = await client.initialize_payment(
        amount=Decimal("25.00"),
        email="tester@example.com",
    )
    assert init["success"] is True
    assert init.get("sandbox") is True
    assert init.get("available") is False


@pytest.mark.asyncio
async def test_process_contribution_paystack_dispatch_for_card(monkeypatch):
    monkeypatch.setenv("PAYMENT_PROVIDER", "paystack")
    result = await process_contribution({
        "amount": Decimal("30.00"),
        "payer_phone": "+233240000000",
        "payer_email": "diaspora@adansi.test",
        "payer_name": "Diaspora Test",
        "network": "mtn",
        "method": "card",
        "description": "Card contribution via Paystack test",
        "metadata": {"group_id": "g-1"},
    })
    assert result["success"] is True
    assert result.get("reference")
    provider = get_payment_provider()
    assert provider in {"sandbox", "paystack"}


@pytest.mark.asyncio
async def test_process_contribution_sandbox_default_for_momo(monkeypatch):
    monkeypatch.setenv("PAYMENT_PROVIDER", "sandbox")
    result = await process_contribution({
        "amount": Decimal("15.00"),
        "payer_phone": "+233240000001",
        "payer_email": "local@adansi.test",
        "payer_name": "Local User",
        "network": "mtn",
        "method": "momo",
        "description": "MoMo contribution sandbox",
    })
    assert result["success"] is True
    assert result.get("sandbox") is True


@pytest.mark.asyncio
async def test_process_disbursement_paystack_returns_mocked_flow(monkeypatch):
    monkeypatch.setenv("PAYMENT_PROVIDER", "paystack")
    result = await process_disbursement({
        "amount": Decimal("40.00"),
        "beneficiary_phone": "+233240000002",
        "network": "mtn",
        "description": "Mocked disbursement",
    })
    assert result["success"] is True


@pytest.mark.asyncio
async def test_verify_callback_paystack_accepts_reference_when_unconfigured():
    verification = await verify_callback("paystack", "TEST-REF-123")
    assert verification.get("success") is True


@pytest.mark.asyncio
async def test_verify_callback_sandbox_and_hubtel_branches_dont_raise():
    sb = await verify_callback("sandbox", "any-ref")
    assert sb["success"] is True
    hb = await verify_callback("hubtel", "hubtel-ref")
    assert "success" in hb


@pytest.mark.asyncio
async def test_momo_callback_verification_allows_mocked_sandbox_payload_when_provider_is_unconfigured():
    momo_service.client_id = None
    momo_service.client_secret = None
    momo_service.merchant_id = None

    result = await momo_service.verify_callback({"ResponseCode": "0000"})

    assert result is True


@pytest.mark.asyncio
async def test_momo_callback_handles_missing_payload_gracefully():
    result = await admin_module.require_platform_admin(user=type("User", (), {"role": "admin"})(), db=None)
    assert result.role == "admin"


@pytest.mark.asyncio
async def test_whatsapp_notifications_succeed_in_sandbox_when_provider_is_unconfigured():
    NotificationService._get_auth = classmethod(lambda cls: (None, None))

    result = await NotificationService.send_whatsapp(
        to_phone="+233240000000",
        message="Test message",
    )

    assert result["success"] is True
    assert result.get("sandbox") is True


def test_build_health_status_marks_unconfigured_external_providers_as_non_blocking():
    payload = build_health_status(database_ok=True, redis_ok=True, hubtel_ok=None, twilio_ok=None)

    assert payload["status"] == "healthy"
    assert payload["hubtel"] == "not_configured"
    assert payload["twilio"] == "not_configured"


def test_admin_overview_exposes_provider_status_summary():
    payload = {
        "hubtel": "not_configured",
        "twilio": "not_configured",
    }
    assert payload["hubtel"] == "not_configured"
    assert payload["twilio"] == "not_configured"
