"""Paystack integration: card payments for test/dev mode, webhook verification.

Per the Cursor development guide, Paystack is used for test-mode card payments so the
card payment flow uses real test card numbers and realistic webhooks. Hubtel remains the
production target (MoMo collections) and its client file is kept fully structured with
the exact API signatures required for a live switchover.
"""
import hashlib
import hmac
import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
import httpx

from app.config import get_settings

settings = get_settings()


class PaystackClient:
    """Handles all Paystack card-payment operations (initiate, verify, webhook)."""

    def __init__(self):
        self.base_url = settings.paystack_base_url.rstrip("/")
        self.secret_key = settings.paystack_test_secret_key
        self.public_key = settings.paystack_test_public_key

    @property
    def is_configured(self) -> bool:
        return bool(self.secret_key and self.secret_key not in {"", "your-paystack-secret-key"})

    def _generate_reference(self, prefix: str = "ADNS") -> str:
        return f"{prefix}-{uuid.uuid4().hex[:12].upper()}"

    def _auth_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    async def initialize_payment(
        self,
        amount: Decimal,
        email: str,
        callback_url: Optional[str] = None,
        reference: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        channels: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        """Initiate a Paystack card payment and return {authorization_url, reference, access_code}.

        Paystack expects amount in the currency's smallest unit (kobo for GHS, cents for USD).
        We convert Decimal amount to kobo (amount * 100) as Ghana uses cedis = 100 pesewas.
        """
        reference = reference or self._generate_reference("PSK")
        payload = {
            "email": email or "contribution@adansi.app",
            "amount": int(Decimal(str(amount)) * Decimal("100")),
            "reference": reference,
            "currency": "GHS",
        }
        if callback_url:
            payload["callback_url"] = callback_url
        if metadata:
            payload["metadata"] = metadata
        if channels:
            payload["channels"] = channels

        if not self.is_configured:
            return {
                "success": True,
                "available": False,
                "reference": reference,
                "sandbox": True,
                "status": "paystack_mocked",
                "authorization_url": None,
                "access_code": "MOCKED_ACCESS_CODE",
                "message": "Paystack not configured; using local mock flow",
            }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/transaction/initialize",
                headers=self._auth_headers(),
                json=payload,
                timeout=30.0,
            )
            data = response.json() if response.status_code == 200 else {"raw": response.text}
            if response.status_code != 200 or not data.get("status"):
                return {
                    "success": False,
                    "available": True,
                    "reference": reference,
                    "error": data.get("message") or f"Paystack returned HTTP {response.status_code}",
                    "raw": data,
                }
            paystack_data = data.get("data", {})
            return {
                "success": True,
                "available": True,
                "reference": reference,
                "authorization_url": paystack_data.get("authorization_url"),
                "access_code": paystack_data.get("access_code"),
                "paystack_reference": paystack_data.get("reference") or reference,
            }

    async def verify_transaction(self, reference: str) -> Dict[str, Any]:
        """Verify a completed Paystack transaction and return settled amount + status."""
        if not self.is_configured:
            return {
                "success": True,
                "available": False,
                "sandbox": True,
                "reference": reference,
                "status": "success",
                "amount": Decimal("0"),
                "message": "Paystack not configured; verification mocked as success",
            }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/transaction/verify/{reference}",
                headers=self._auth_headers(),
                timeout=30.0,
            )
            data = response.json() if response.status_code == 200 else {"raw": response.text}
            if response.status_code != 200 or not data.get("status"):
                return {
                    "success": False,
                    "reference": reference,
                    "error": data.get("message") or f"Paystack verify returned HTTP {response.status_code}",
                    "raw": data,
                }
            tx = data.get("data", {})
            amount_kobo = int(tx.get("amount", 0))
            amount_ghs = Decimal(amount_kobo) / Decimal("100")
            return {
                "success": True,
                "available": True,
                "reference": tx.get("reference") or reference,
                "status": tx.get("status"),
                "amount": amount_ghs,
                "paid_at": tx.get("paid_at"),
                "channel": tx.get("channel"),
                "customer": tx.get("customer"),
                "paystack_transaction_id": tx.get("id"),
            }

    def verify_webhook_signature(self, raw_body: bytes, signature_header: str | None) -> bool:
        """Validate Paystack webhook by comparing x-paystack-signature against HMAC SHA512."""
        if not self.is_configured or not signature_header:
            return False
        expected = hmac.new(
            self.secret_key.encode("utf-8"),
            raw_body,
            hashlib.sha512,
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)

    async def receive_money(
        self,
        amount: Decimal,
        email: str,
        description: Optional[str] = None,
        reference: Optional[str] = None,
        callback_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Provider-agnostic alias — same signature as hubtel_client.receiveMoney()."""
        result = await self.initialize_payment(
            amount=amount,
            email=email,
            callback_url=callback_url,
            reference=reference,
            metadata=metadata,
        )
        return {
            **result,
            "transactionId": result.get("paystack_transaction_id") or result.get("reference"),
            "description": description,
        }

    async def send_money(
        self,
        amount: Decimal,
        phone: str,
        network: str = "mtn",
        description: Optional[str] = None,
        reference: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Provider-agnostic alias — same signature as hubtel_client.sendMoney().

        For MVP / test mode, disbursements via Paystack are mocked because Ghana MoMo
        disbursement is Hubtel's production responsibility. This keeps the interface
        contract aligned with the Hubtel Cursor guide so the swap is drop-in.
        """
        reference = reference or self._generate_reference("WITH")
        return {
            "success": True,
            "available": self.is_configured,
            "reference": reference,
            "sandbox": not self.is_configured,
            "status": "paystack_disbursement_mocked",
            "transactionId": f"MOCK-DISB-{reference}",
            "message": "Disbursement mocked for Paystack test mode; production will route through Hubtel",
        }


paystack_client = PaystackClient()
