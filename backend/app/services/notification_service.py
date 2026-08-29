"""Notification service: Twilio WhatsApp + SMS delivery."""
from typing import Optional
import httpx
from app.config import get_settings

settings = get_settings()


class NotificationService:
    """Sends notifications via Twilio WhatsApp and SMS."""

    TWILIO_API_URL = "https://api.twilio.com/2010-04-01"

    @classmethod
    def _get_auth(cls) -> tuple:
        return (settings.twilio_account_sid, settings.twilio_auth_token)

    @classmethod
    async def send_whatsapp(cls, to_phone: str, message: str) -> dict:
        """Send WhatsApp message via Twilio."""
        try:
            url = f"{cls.TWILIO_API_URL}/Accounts/{settings.twilio_account_sid}/Messages.json"
            payload = {
                "From": settings.twilio_whatsapp_number,
                "To": f"whatsapp:{to_phone}",
                "Body": message
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    auth=cls._get_auth(),
                    data=payload,
                    timeout=30.0
                )
                data = response.json()
                return {
                    "success": response.status_code == 201,
                    "message_sid": data.get("sid"),
                    "status": data.get("status"),
                    "error": data.get("error_message") if response.status_code != 201 else None
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @classmethod
    async def send_sms(cls, to_phone: str, message: str) -> dict:
        """Send SMS via Twilio."""
        try:
            url = f"{cls.TWILIO_API_URL}/Accounts/{settings.twilio_account_sid}/Messages.json"
            payload = {
                "From": settings.twilio_whatsapp_number.replace("whatsapp:", ""),
                "To": to_phone,
                "Body": message
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    auth=cls._get_auth(),
                    data=payload,
                    timeout=30.0
                )
                data = response.json()
                return {
                    "success": response.status_code == 201,
                    "message_sid": data.get("sid"),
                    "status": data.get("status"),
                    "error": data.get("error_message") if response.status_code != 201 else None
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @classmethod
    async def send_contribution_alert(cls, phone: str, contributor_name: str, amount: float, group_name: str, new_balance: float) -> dict:
        """Send contribution notification to group members."""
        message = f"ADANSI: {contributor_name} contributed GHS {amount:.2f} to '{group_name}'. New balance: GHS {new_balance:.2f}."
        return await cls.send_whatsapp(phone, message)

    @classmethod
    async def send_withdrawal_request(cls, phone: str, requester_name: str, amount: float, group_name: str, withdrawal_id: str) -> dict:
        """Notify members that a withdrawal needs approval."""
        message = f"ADANSI: {requester_name} requests GHS {amount:.2f} withdrawal from '{group_name}'. Reply /approve {withdrawal_id} or /reject {withdrawal_id}"
        return await cls.send_whatsapp(phone, message)

    @classmethod
    async def send_withdrawal_completed(cls, phone: str, amount: float, group_name: str, agent_id: str) -> dict:
        """Notify that withdrawal was completed."""
        message = f"ADANSI: GHS {amount:.2f} withdrawn from '{group_name}'. Verified by Agent #{agent_id}."
        return await cls.send_whatsapp(phone, message)

    @classmethod
    async def send_credit_update(cls, phone: str, new_score: int, max_loan: float) -> dict:
        """Notify user of credit score change."""
        message = f"ADANSI: Your credit score is now {new_score}! You are eligible for loans up to GHS {max_loan:.2f}."
        return await cls.send_whatsapp(phone, message)

    @classmethod
    async def send_loan_reminder(cls, phone: str, amount: float, due_date: str) -> dict:
        """Remind user of upcoming loan repayment."""
        message = f"ADANSI: Your loan of GHS {amount:.2f} is due on {due_date}. Repay via USSD: *422*1# -> Loans -> Repay"
        return await cls.send_whatsapp(phone, message)

    @classmethod
    async def send_group_invite(cls, phone: str, inviter_name: str, group_name: str, group_code: str) -> dict:
        """Send group invitation."""
        message = f"ADANSI: {inviter_name} invited you to join '{group_name}'. Join: https://adansi.app/join/{group_code} or dial *422*1# -> Join Group -> {group_code}"
        return await cls.send_whatsapp(phone, message)


notification_service = NotificationService()
