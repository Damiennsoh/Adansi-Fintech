"""MoMo payment and callback endpoints."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from decimal import Decimal

from app.database import get_db
from app.services.momo_service import momo_service
from app.schemas.contribution import MomoCallbackPayload
from app.models import Contribution, Withdrawal, Transaction

router = APIRouter(prefix="/momo", tags=["MoMo Payments"])


def classify_client_reference(reference: str | None) -> str:
    """Classify a Hubtel client reference by its internal prefix."""
    if not reference:
        return "unknown"
    prefix = reference.split("-", 1)[0].upper()
    if prefix == "CONT":
        return "contribution"
    if prefix == "WITH":
        return "withdrawal"
    return "unknown"


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
    reference = data.get("ClientReference")
    if not reference:
        return {"status": "ignored", "reason": "Missing ClientReference"}

    kind = classify_client_reference(reference)
    if kind == "contribution":
        contribution = await db.scalar(
            select(Contribution).where(Contribution.transaction_ref == reference).with_for_update()
        )
        if not contribution:
            return {"status": "ignored", "reason": "Contribution not found"}

        if contribution.status == "completed":
            return {"status": "already_processed", "reference": reference, "transaction_id": data.get("TransactionId")}

        contribution.status = "completed"
        contribution.momo_transaction_id = data.get("TransactionId")
        db.add(Transaction(
            type="contribution",
            reference=reference,
            amount=contribution.amount,
            group_id=contribution.group_id,
            user_id=contribution.user_id,
            status="completed",
            external_ref=data.get("TransactionId")
        ))
        await db.commit()
        return {
            "status": "processed",
            "reference": reference,
            "transaction_id": data.get("TransactionId"),
            "amount": data.get("Amount"),
            "kind": "contribution",
        }

    if kind == "withdrawal":
        withdrawal = await db.scalar(
            select(Withdrawal).where(Withdrawal.momo_disbursement_ref == reference).with_for_update()
        )
        if not withdrawal:
            withdrawal = await db.scalar(
                select(Withdrawal).where(Withdrawal.id == reference).with_for_update()
            )
        if not withdrawal:
            return {"status": "ignored", "reason": "Withdrawal not found"}

        if withdrawal.status == "disbursed":
            return {"status": "already_processed", "reference": reference, "transaction_id": data.get("TransactionId")}

        withdrawal.status = "disbursed"
        withdrawal.disbursed_at = __import__('datetime').datetime.utcnow()
        withdrawal.momo_disbursement_ref = reference
        db.add(Transaction(
            type="withdrawal",
            reference=reference,
            amount=withdrawal.amount,
            group_id=withdrawal.group_id,
            user_id=withdrawal.requested_by,
            status="completed",
            external_ref=data.get("TransactionId")
        ))
        await db.commit()
        return {
            "status": "processed",
            "reference": reference,
            "transaction_id": data.get("TransactionId"),
            "amount": data.get("Amount"),
            "kind": "withdrawal",
        }

    return {
        "status": "ignored",
        "reason": "Unknown transaction reference type",
        "reference": reference,
    }


@router.get("/transaction/{ref}")
async def query_transaction(ref: str, db: AsyncSession = Depends(get_db)):
    """Query transaction status by internal reference."""
    return {"reference": ref, "status": "pending"}
