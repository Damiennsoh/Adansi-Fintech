"""MoMo payment and callback endpoints."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from app.database import get_db
from app.services.momo_service import momo_service
from app.schemas.contribution import MomoCallbackPayload

router = APIRouter(prefix="/momo", tags=["MoMo Payments"])


@router.post("/request-payment")
async def request_payment(phone: str, amount: Decimal, description: str, db: AsyncSession = Depends(get_db)):
    """Request money from user's MoMo wallet (collections)."""
    result = await momo_service.request_payment(phone, amount, description)
    return result


@router.post("/disburse")
async def disburse_funds(phone: str, amount: Decimal, description: str, db: AsyncSession = Depends(get_db)):
    """Disburse funds to user's MoMo wallet (withdrawals/loans)."""
    result = await momo_service.disburse_funds(phone, amount, description)
    return result


@router.post("/callback/hubtel")
async def momo_callback(payload: MomoCallbackPayload, db: AsyncSession = Depends(get_db)):
    """Receives Hubtel callbacks for both collections and disbursements."""
    is_valid = await momo_service.verify_callback(payload.model_dump())
    if not is_valid:
        return {"status": "ignored", "reason": "Invalid callback"}

    data = payload.Data
    # TODO: Route to correct handler based on ClientReference prefix (CONT- vs WITH-)
    return {
        "status": "processed",
        "reference": data.get("ClientReference"),
        "transaction_id": data.get("TransactionId"),
        "amount": data.get("Amount")
    }


@router.get("/transaction/{ref}")
async def query_transaction(ref: str, db: AsyncSession = Depends(get_db)):
    """Query transaction status by internal reference."""
    return {"reference": ref, "status": "pending"}
