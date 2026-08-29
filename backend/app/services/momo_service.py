"""Hubtel MoMo integration: collections and disbursements."""
import base64
import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
import httpx

from app.config import get_settings

settings = get_settings()


class MomoService:
    """Handles all MoMo payment operations via Hubtel."""

    def __init__(self):
        self.base_url = settings.hubtel_base_url
        self.merchant_id = settings.hubtel_merchant_id
        self.client_id = settings.hubtel_client_id
        self.client_secret = settings.hubtel_client_secret
        self.auth_header = self._build_auth_header()

    def _build_auth_header(self) -> str:
        """Build Basic Auth header from client credentials."""
        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        return f"Basic {credentials}"

    def _generate_reference(self, prefix: str = "ADNS") -> str:
        """Generate unique internal transaction reference."""
        return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

    async def request_payment(
        self,
        phone: str,
        amount: Decimal,
        description: str,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Request money from a user's MoMo wallet (collections)."""
        if not callback_url:
            callback_url = f"https://your-api-url.com/api/v1/momo/callback/hubtel"

        reference = self._generate_reference("CONT")
        payload = {
            "CustomerName": "ADANSI User",
            "CustomerMsisdn": phone,
            "CustomerEmail": "user@adansi.app",
            "Channel": "mtn-gh",
            "Amount": float(amount),
            "PrimaryCallbackUrl": callback_url,
            "Description": description,
            "ClientReference": reference
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/merchantaccount/merchants/{self.merchant_id}/receive/mobilemoney",
                headers={"Authorization": self.auth_header, "Content-Type": "application/json"},
                json=payload,
                timeout=30.0
            )
            return {
                "success": response.status_code == 200,
                "reference": reference,
                "hubtel_response": response.json() if response.status_code == 200 else response.text,
                "status_code": response.status_code
            }

    async def disburse_funds(
        self,
        phone: str,
        amount: Decimal,
        description: str,
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send money to a user's MoMo wallet (disbursements)."""
        if not callback_url:
            callback_url = f"https://your-api-url.com/api/v1/momo/callback/hubtel"

        reference = self._generate_reference("WITH")
        payload = {
            "RecipientName": "ADANSI User",
            "RecipientMsisdn": phone,
            "RecipientEmail": "user@adansi.app",
            "Channel": "mtn-gh",
            "Amount": float(amount),
            "PrimaryCallbackUrl": callback_url,
            "Description": description,
            "ClientReference": reference
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/merchantaccount/merchants/{self.merchant_id}/send/mobilemoney",
                headers={"Authorization": self.auth_header, "Content-Type": "application/json"},
                json=payload,
                timeout=30.0
            )
            return {
                "success": response.status_code == 200,
                "reference": reference,
                "hubtel_response": response.json() if response.status_code == 200 else response.text,
                "status_code": response.status_code
            }

    async def verify_callback(self, payload: Dict[str, Any]) -> bool:
        """Verify Hubtel callback authenticity (simplified for MVP)."""
        # In production: verify signature header against shared secret
        # For hackathon: check ResponseCode == "0000"
        return payload.get("ResponseCode") == "0000"


momo_service = MomoService()
