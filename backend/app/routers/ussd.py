"""USSD webhook endpoints with Redis-backed state machine."""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

from app.services.redis_service import redis_service
from app.services.group_service import group_service
from app.services.momo_service import momo_service
from app.database import AsyncSessionLocal
from app.models import User, Group, GroupMember
from sqlalchemy import select

router = APIRouter(prefix="/ussd", tags=["USSD"])


class HubtelUssdRequest(BaseModel):
    """Hubtel USSD webhook payload."""
    sessionId: str
    phoneNumber: str
    userData: str
    network: str
    sequence: int  # 1=begin, 2=continue, 3=end


class UssdResponse(BaseModel):
    """Hubtel USSD response format."""
    message: str
    continueSession: bool


@router.post("/webhook/hubtel")
async def handle_ussd(request: HubtelUssdRequest):
    """Primary Hubtel USSD webhook. Receives ALL USSD traffic."""
    session_id = request.sessionId
    phone = request.phoneNumber
    user_input = request.userData.strip()

    # Get or create session from Redis
    session = redis_service.get_ussd_session(session_id) or {
        "menu": "main",
        "data": {},
        "phone": phone
    }

    if request.sequence == 3 or user_input == "0":
        # End session
        redis_service.delete_ussd_session(session_id)
        return UssdResponse(message="Thank you for using ADANSI. Goodbye!", continueSession=False)

    current_menu = session.get("menu", "main")

    # Look up user by phone
    async with AsyncSessionLocal() as db:
        user_result = await db.execute(select(User).where(User.phone == phone))
        user = user_result.scalar_one_or_none()

    if current_menu == "main":
        if user_input == "1":
            session["menu"] = "my_groups"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Your groups: 1. Dad's Funeral 2. Wedding Fund 0. Back", continueSession=True)
        elif user_input == "2":
            session["menu"] = "join_group"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Enter group code:", continueSession=True)
        elif user_input == "3":
            session["menu"] = "contribute_select"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Select group: 1. Dad's Funeral 2. Wedding Fund 0. Back", continueSession=True)
        elif user_input == "4":
            session["menu"] = "balance_select"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Select group: 1. Dad's Funeral 2. Wedding Fund 0. Back", continueSession=True)
        elif user_input == "5":
            session["menu"] = "loans_menu"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Loans: 1. Check Eligibility 2. Apply 3. Repay 0. Back", continueSession=True)
        else:
            return UssdResponse(
                message="Welcome to ADANSI. 1. My Groups 2. Join Group 3. Contribute 4. Check Balance 5. Loans",
                continueSession=True
            )

    elif current_menu == "join_group":
        group = await group_service.get_group_by_code(user_input)
        if not group:
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Group not found. Try again:", continueSession=True)

        session["data"]["target_group_id"] = str(group.id)
        session["data"]["target_group_name"] = group.name
        session["menu"] = "join_confirm"
        redis_service.set_ussd_session(session_id, session)
        return UssdResponse(message=f"Join {group.name}? 1. Yes 2. No", continueSession=True)

    elif current_menu == "join_confirm":
        if user_input == "1":
            group_id = session["data"].get("target_group_id")
            if user and group_id:
                await group_service.join_group(group_id, user.id)
            session["menu"] = "main"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Joined successfully! 0. Back", continueSession=True)
        else:
            session["menu"] = "main"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Cancelled. 0. Back", continueSession=True)

    elif current_menu == "contribute_select":
        # TODO: Fetch user's actual groups
        session["menu"] = "contribute_amount"
        session["data"]["group_name"] = "Dad's Funeral"  # Mock for now
        redis_service.set_ussd_session(session_id, session)
        return UssdResponse(message="Enter amount (GHS):", continueSession=True)

    elif current_menu == "contribute_amount":
        try:
            amount = Decimal(user_input)
            if amount < 1:
                redis_service.set_ussd_session(session_id, session)
                return UssdResponse(message="Minimum GHS 1. Enter amount:", continueSession=True)

            session["data"]["amount"] = str(amount)
            session["menu"] = "contribute_confirm"
            redis_service.set_ussd_session(session_id, session)
            group_name = session["data"].get("group_name", "group")
            return UssdResponse(message=f"Contribute GHS {amount} to {group_name}? 1. Yes 2. No", continueSession=True)
        except:
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Invalid amount. Enter numbers only:", continueSession=True)

    elif current_menu == "contribute_confirm":
        if user_input == "1":
            amount = Decimal(session["data"].get("amount", 0))
            if user and amount > 0:
                result = await momo_service.request_payment(
                    phone=phone,
                    amount=amount,
                    description="ADANSI USSD contribution"
                )
            session["menu"] = "main"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Payment request sent. Check your phone to confirm. 0. Back", continueSession=True)
        else:
            session["menu"] = "main"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Cancelled. 0. Back", continueSession=True)

    elif current_menu == "balance_select":
        session["menu"] = "main"
        redis_service.set_ussd_session(session_id, session)
        return UssdResponse(message="Balance: GHS 1,240. Your contribution: GHS 150. 0. Back", continueSession=True)

    elif current_menu == "loans_menu":
        if user_input == "1":
            session["menu"] = "main"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Your credit score: 720. Max loan: GHS 600. Eligible: Yes. 0. Back", continueSession=True)
        elif user_input == "2":
            session["menu"] = "main"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="Enter loan amount (max GHS 600):", continueSession=True)
        else:
            session["menu"] = "main"
            redis_service.set_ussd_session(session_id, session)
            return UssdResponse(message="0. Back", continueSession=True)

    # Default fallback
    session["menu"] = "main"
    redis_service.set_ussd_session(session_id, session)
    return UssdResponse(
        message="Welcome to ADANSI. 1. My Groups 2. Join Group 3. Contribute 4. Check Balance 5. Loans",
        continueSession=True
    )


@router.get("/menu/{step}")
async def get_menu_text(step: str):
    """Debug: get menu text for a specific USSD step."""
    menus = {
        "main": "Welcome to ADANSI. 1. My Groups 2. Join Group 3. Contribute 4. Check Balance 5. Loans",
        "join_group": "Enter group code:",
        "contribute_amount": "Enter amount (GHS):",
        "balance_result": "Balance: GHS 1,240. Your contribution: GHS 150. 0. Back"
    }
    return {"step": step, "text": menus.get(step, "Unknown step")}


@router.post("/session/reset")
async def reset_session(phone: str):
    """Support: force-reset a stuck USSD session."""
    # Note: In production, we'd need to iterate all keys or use a phone index
    # For MVP: just acknowledge
    return {"message": f"Session reset requested for {phone}. Please dial *422*1# again."}
