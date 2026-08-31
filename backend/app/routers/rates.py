"""Server-side exchange rate quotes with short-lived provider caching."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException
import httpx
from app.services.redis_service import RedisService

router = APIRouter(prefix="/rates", tags=["Rates"])

@router.get("/{base}")
async def get_rate(base: str):
    base = base.upper()
    if base not in {"USD", "GBP", "EUR", "CAD"}:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    now = datetime.now(timezone.utc)
    cached = RedisService.get_json(f"rate:{base}:GHS")
    if cached and datetime.fromisoformat(cached["expires_at"]) > now:
        return {**cached, "cached": True}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get("https://api.frankfurter.app/latest", params={"from": base, "to": "GHS"})
            response.raise_for_status()
            payload = response.json()
        rate = payload.get("rates", {}).get("GHS")
        if not rate:
            raise ValueError("Provider did not return GHS")
        quote = {"quote_id": str(uuid4()), "base_currency": base, "quote_currency": "GHS", "rate": rate, "provider": "frankfurter", "fetched_at": now.isoformat(), "expires_at": (now + timedelta(minutes=15)).isoformat()}
        RedisService.set_json(f"rate:{base}:GHS", quote, 900)
        return {**quote, "cached": False}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Exchange rate provider unavailable") from exc
