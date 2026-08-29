"""Credit score and loan endpoints with full engine integration."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from app.database import get_db
from app.middleware.auth import get_current_user
from app.services.credit_service import credit_engine
from app.services.momo_service import momo_service
from app.services.notification_service import notification_service
from app.schemas.credit import LoanApplyRequest, LoanRepayRequest, GroupVouchRequest, LoanResponse
from app.models import CreditProfile, Loan, Group, GroupMember, User, Transaction

router = APIRouter(prefix="/credit", tags=["Credit"])


@router.get("/me")
async def get_my_credit(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current user's credit score and eligibility."""
    result = await credit_engine.calculate_score(current_user.id)

    return {
        "user_id": str(current_user.id),
        "credit_score": result["score"],
        "tier": result["tier"],
        "loan_eligible": result["loan_eligible"],
        "max_loan_amount": result["max_loan_amount"],
        "breakdown": result["breakdown"],
        "calculated_at": result["calculated_at"]
    }


@router.get("/me/history")
async def get_credit_history(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get credit score history over time."""
    # For MVP: return current score only
    # In production: query credit score history table
    result = await credit_engine.calculate_score(current_user.id)
    return {
        "history": [
            {"score": result["score"], "calculated_at": result["calculated_at"]}
        ]
    }


@router.post("/loans/apply")
async def apply_for_loan(
    request: LoanApplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Apply for a micro-loan (individual or group-backed)."""
    # Check eligibility
    credit_result = await credit_engine.calculate_score(current_user.id)

    if not credit_result["loan_eligible"]:
        raise HTTPException(status_code=400, detail="You are not eligible for a loan at this time")

    if request.amount > credit_result["max_loan_amount"]:
        raise HTTPException(status_code=400, detail=f"Maximum loan amount is GHS {credit_result['max_loan_amount']}")

    # Determine interest rate based on tier
    tier_rates = {"bronze": 8.0, "silver": 6.0, "gold": 4.0, "platinum": 3.0}
    base_rate = tier_rates.get(credit_result["tier"], 8.0)

    # Group vouch discount
    if request.group_id:
        group = await db.get(Group, request.group_id)
        if group:
            # Check if user is member
            member_check = await db.execute(
                select(GroupMember).where(
                    GroupMember.group_id == request.group_id,
                    GroupMember.user_id == current_user.id
                )
            )
            if member_check.scalar_one_or_none():
                base_rate -= 1.5  # Group vouch discount

    base_rate = max(base_rate, 2.0)  # Floor at 2%

    # Calculate total repayable
    interest = request.amount * Decimal(str(base_rate)) / 100
    total_repayable = request.amount + interest

    # Create loan record
    loan = Loan(
        user_id=current_user.id,
        group_id=request.group_id,
        amount=request.amount,
        interest_rate=Decimal(str(base_rate)),
        purpose=request.purpose,
        total_repayable=total_repayable,
        due_date=datetime.utcnow() + timedelta(days=30)
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)

    return {
        "message": "Loan application submitted",
        "loan_id": str(loan.id),
        "amount": float(request.amount),
        "interest_rate": base_rate,
        "total_repayable": float(total_repayable),
        "due_date": loan.due_date.isoformat() if loan.due_date else None,
        "status": "applied"
    }


@router.get("/loans")
async def list_loans(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List user's loans with status."""
    result = await db.execute(
        select(Loan).where(Loan.user_id == current_user.id).order_by(Loan.created_at.desc())
    )
    loans = result.scalars().all()
    return {"loans": loans, "count": len(loans)}


@router.get("/loans/{loan_id}")
async def get_loan(loan_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get loan details, repayment schedule, and remaining balance."""
    loan = await db.get(Loan, loan_id)
    if not loan or loan.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Loan not found")

    remaining = loan.total_repayable - loan.amount_repaid if loan.total_repayable else loan.amount

    return {
        "loan_id": str(loan.id),
        "amount": float(loan.amount),
        "interest_rate": float(loan.interest_rate),
        "status": loan.status,
        "purpose": loan.purpose,
        "due_date": loan.due_date.isoformat() if loan.due_date else None,
        "total_repayable": float(loan.total_repayable) if loan.total_repayable else None,
        "amount_repaid": float(loan.amount_repaid),
        "remaining_balance": float(remaining),
        "created_at": loan.created_at
    }


@router.post("/loans/{loan_id}/repay")
async def repay_loan(
    loan_id: UUID,
    request: LoanRepayRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Repay loan via MoMo."""
    loan = await db.get(Loan, loan_id)
    if not loan or loan.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status not in ["disbursed", "repaying"]:
        raise HTTPException(status_code=400, detail="Loan is not in repayable status")

    remaining = loan.total_repayable - loan.amount_repaid if loan.total_repayable else loan.amount
    if request.amount > remaining:
        raise HTTPException(status_code=400, detail=f"Repayment amount exceeds remaining balance of GHS {remaining}")

    # Request MoMo payment
    result = await momo_service.request_payment(
        phone=current_user.phone,
        amount=request.amount,
        description=f"ADANSI loan repayment for loan {loan_id}"
    )

    if not result["success"]:
        raise HTTPException(status_code=502, detail="Payment request failed")

    # Update loan (in real implementation, this would happen in callback)
    loan.amount_repaid += request.amount
    if loan.amount_repaid >= loan.total_repayable:
        loan.status = "repaid"
        loan.repaid_at = datetime.utcnow()
    else:
        loan.status = "repaying"

    await db.commit()

    return {
        "message": "Repayment initiated",
        "loan_id": str(loan_id),
        "amount": float(request.amount),
        "remaining": float(loan.total_repayable - loan.amount_repaid) if loan.total_repayable else 0,
        "status": loan.status
    }


@router.post("/loans/{loan_id}/group-vouch")
async def group_vouch(
    loan_id: UUID,
    request: GroupVouchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Group admin vouches for a member's loan."""
    loan = await db.get(Loan, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Verify current user is admin of the loan's group
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == loan.group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == "admin"
        )
    )
    if not admin_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only group admins can vouch for loans")

    if request.approved:
        # Reduce interest rate by 1.5%
        loan.interest_rate = max(loan.interest_rate - Decimal("1.5"), Decimal("2.0"))
        loan.approved_by = current_user.id
        await db.commit()

    return {"message": "Vouch recorded", "approved": request.approved, "new_rate": float(loan.interest_rate)}


@router.post("/recalculate")
async def recalculate_credit_scores(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Admin endpoint: trigger batch credit score recalculation."""
    # For MVP: just recalculate current user's score
    result = await credit_engine.calculate_score(current_user.id)
    return {
        "message": "Credit score recalculated",
        "user_id": str(current_user.id),
        "new_score": result["score"]
    }
