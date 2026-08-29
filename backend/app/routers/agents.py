"""Agent verification endpoints."""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.post("/verify")
async def agent_login(agent_id: str, pin: str, db: AsyncSession = Depends(get_db)):
    """Agent login with agent ID + PIN."""
    return {"message": "Agent logged in", "agent_id": agent_id}


@router.get("/pending-verifications")
async def get_pending_verifications(agent_id: str, db: AsyncSession = Depends(get_db)):
    """List withdrawals pending agent verification."""
    return {"pending": []}


@router.post("/verify-withdrawal/{withdrawal_id}")
async def verify_withdrawal(withdrawal_id: UUID, agent_id: str, db: AsyncSession = Depends(get_db)):
    """Submit verification for a withdrawal."""
    return {"message": "Verification submitted", "withdrawal_id": str(withdrawal_id)}


@router.get("/history")
async def get_agent_history(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Get verification history for logged-in agent."""
    return {"history": []}
