from decimal import Decimal

import pytest

from app.main import build_health_status
from app.services.momo_service import momo_service
from app.services.notification_service import NotificationService


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
async def test_momo_callback_verification_allows_mocked_sandbox_payload_when_provider_is_unconfigured():
    momo_service.client_id = None
    momo_service.client_secret = None
    momo_service.merchant_id = None

    result = await momo_service.verify_callback({"ResponseCode": "0000"})

    assert result is True


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
