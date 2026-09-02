"""WhatsApp Business API webhook endpoints."""
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional

from app.services.auth_service import auth_service

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


def normalize_whatsapp_phone(value: str | None) -> str:
    """Strip Twilio's whatsapp: prefix and normalize the recipient phone."""
    if not value:
        return ""
    return value.replace("whatsapp:", "").strip()


def parse_whatsapp_command(from_phone: str, body: str):
    """Parse a WhatsApp message into the command, arg, and normalized phone."""
    phone = normalize_whatsapp_phone(from_phone)
    text = (body or "").strip()
    if not text:
        return "", "", phone
    parts = text.split()
    command = parts[0].lower()
    arg = parts[1] if len(parts) > 1 else ""
    return command, arg, phone


@router.post("/webhook/twilio")
async def handle_whatsapp(request: Request):
    """Twilio incoming message webhook. Handles commands like /balance, /approve."""
    form_data = await request.form()
    from_phone = normalize_whatsapp_phone(form_data.get("From", ""))
    body = form_data.get("Body", "").strip()
    message_sid = form_data.get("MessageSid")

    command, arg, phone = parse_whatsapp_command(from_phone, body)

    user = await auth_service.get_user_by_phone(phone) if phone else None

    if command == "/balance":
        if not arg:
            return {"reply": "Use /balance {group_code}."}
        return {"reply": f"Group {arg}: Balance: GHS 1,240. Your contribution: GHS 150."}

    elif command == "/approve":
        if not arg:
            return {"reply": "Use /approve {withdrawal_id}."}
        return {"reply": f"Approved withdrawal {arg}. 2/3 approvals received."}

    elif command == "/reject":
        if not arg:
            return {"reply": "Use /reject {withdrawal_id}."}
        return {"reply": f"Rejected withdrawal {arg}."}

    elif command == "/credit":
        return {"reply": "Your ADANSI credit score: 720. Max loan: GHS 600. Eligible: Yes."}

    elif command == "/help":
        return {"reply": "Commands: /balance {code}, /approve {id}, /reject {id}, /credit, /help"}

    else:
        return {"reply": "I didn't understand that. Reply /help for available commands."}


@router.post("/send")
async def send_whatsapp(phone: str, message: str, template: Optional[str] = None):
    """Internal: send outbound WhatsApp notification."""
    return {"message": "Message queued", "phone": normalize_whatsapp_phone(phone)}


@router.post("/broadcast")
async def broadcast_message(group_id: str, message: str):
    """Admin: broadcast message to all group members."""
    return {"message": "Broadcast queued", "group_id": group_id, "recipients": 0}
