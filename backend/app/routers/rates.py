"""Server-side exchange rate quotes with short-lived provider caching."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter(prefix="/rates", tags=["Rates"])

@router.get("/{base}")
async def get_rate(base: str):
    base = base.upper()
    if base not in {"USD", "GBP", "EUR", "CAD"}:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    now = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get("https://api.frankfurter.app/latest", params={"from": base, "to": "GHS"})
            response.raise_for_status()
            payload = response.json()
        rate = payload.get("rates", {}).get("GHS")
        if not rate:
            raise ValueError("Provider did not return GHS")
        return {"base_currency": base, "quote_currency": "GHS", "rate": rate, "provider": "frankfurter", "fetched_at": now.isoformat(), "expires_at": (now + timedelta(minutes=15)).isoformat()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Exchange rate provider unavailable") from exc
