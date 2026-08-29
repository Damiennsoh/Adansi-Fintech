"""WhatsApp Business API webhook endpoints."""
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional

from app.services.auth_service import auth_service

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.post("/webhook/twilio")
async def handle_whatsapp(request: Request):
    """Twilio incoming message webhook. Handles commands like /balance, /approve."""
    form_data = await request.form()
    from_phone = form_data.get("From", "").replace("whatsapp:", "")
    body = form_data.get("Body", "").strip().lower()
    message_sid = form_data.get("MessageSid")

    parts = body.split()
    command = parts[0] if parts else ""
    arg = parts[1] if len(parts) > 1 else ""

    # TODO: Look up user by phone
    # user = await auth_service.get_user_by_phone(from_phone)

    if command == "/balance":
        return {"reply": f"Group {arg}: Balance: GHS 1,240. Your contribution: GHS 150."}

    elif command == "/approve":
        return {"reply": f"Approved withdrawal {arg}. 2/3 approvals received."}

    elif command == "/reject":
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
    # TODO: Call Twilio Messages API
    return {"message": "Message queued", "phone": phone}


@router.post("/broadcast")
async def broadcast_message(group_id: str, message: str):
    """Admin: broadcast message to all group members."""
    return {"message": "Broadcast queued", "group_id": group_id, "recipients": 0}
