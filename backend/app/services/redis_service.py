"""Redis service for USSD sessions, rate limiting, and caching."""
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import redis
from app.config import get_settings

settings = get_settings()

# Try to connect to Redis (Upstash or local)
try:
    redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    redis_client.ping()
except Exception:
    # Fallback: in-memory dict for hackathon/demo if Redis unavailable
    redis_client = None
    _memory_store: Dict[str, Any] = {}


class RedisService:
    """Handles USSD sessions, rate limiting, and credit score caching."""

    # USSD session TTL: 5 minutes
    USSD_TTL = 300
    # Rate limit window: 15 minutes
    RATE_LIMIT_TTL = 900
    # Credit score cache TTL: 1 hour
    CREDIT_CACHE_TTL = 3600

    @staticmethod
    def _key(prefix: str, identifier: str) -> str:
        return f"adansi:{prefix}:{identifier}"

    @classmethod
    def set_ussd_session(cls, session_id: str, data: dict) -> None:
        """Store USSD session state with TTL."""
        key = cls._key("ussd", session_id)
        expires = datetime.utcnow() + timedelta(seconds=cls.USSD_TTL)
        payload = json.dumps({"data": data, "expires": expires.isoformat()})

        if redis_client:
            redis_client.setex(key, cls.USSD_TTL, payload)
        else:
            _memory_store[key] = payload

    @classmethod
    def get_ussd_session(cls, session_id: str) -> Optional[dict]:
        """Retrieve USSD session state. Returns None if expired."""
        key = cls._key("ussd", session_id)

        if redis_client:
            payload = redis_client.get(key)
        else:
            payload = _memory_store.get(key)

        if not payload:
            return None

        try:
            parsed = json.loads(payload)
            expires = datetime.fromisoformat(parsed["expires"])
            if datetime.utcnow() > expires:
                cls.delete_ussd_session(session_id)
                return None
            return parsed["data"]
        except Exception:
            return None

    @classmethod
    def delete_ussd_session(cls, session_id: str) -> None:
        """Remove USSD session."""
        key = cls._key("ussd", session_id)
        if redis_client:
            redis_client.delete(key)
        else:
            _memory_store.pop(key, None)

    @classmethod
    def check_rate_limit(cls, identifier: str, max_requests: int = 100) -> bool:
        """Check if identifier (phone or IP) has exceeded rate limit."""
        key = cls._key("ratelimit", identifier)

        if redis_client:
            current = redis_client.get(key)
            if current is None:
                redis_client.setex(key, cls.RATE_LIMIT_TTL, "1")
                return True
            count = int(current)
            if count >= max_requests:
                return False
            redis_client.incr(key)
            return True
        else:
            # In-memory rate limiting (resets on restart)
            count = _memory_store.get(key, 0)
            if count >= max_requests:
                return False
            _memory_store[key] = count + 1
            return True

    @classmethod
    def cache_credit_score(cls, user_id: str, score_data: dict) -> None:
        """Cache credit score calculation."""
        key = cls._key("credit", user_id)
        payload = json.dumps(score_data)

        if redis_client:
            redis_client.setex(key, cls.CREDIT_CACHE_TTL, payload)
        else:
            _memory_store[key] = payload

    @classmethod
    def get_cached_credit_score(cls, user_id: str) -> Optional[dict]:
        """Get cached credit score."""
        key = cls._key("credit", user_id)

        if redis_client:
            payload = redis_client.get(key)
        else:
            payload = _memory_store.get(key)

        if payload:
            try:
                return json.loads(payload)
            except Exception:
                return None
        return None

    @classmethod
    def set_pin_attempts(cls, phone: str, attempts: int) -> None:
        """Track failed PIN attempts for lockout."""
        key = cls._key("pin_attempts", phone)
        if redis_client:
            redis_client.setex(key, cls.RATE_LIMIT_TTL, str(attempts))
        else:
            _memory_store[key] = str(attempts)

    @classmethod
    def get_pin_attempts(cls, phone: str) -> int:
        """Get current failed PIN attempts."""
        key = cls._key("pin_attempts", phone)

        if redis_client:
            val = redis_client.get(key)
        else:
            val = _memory_store.get(key)

        return int(val) if val else 0


redis_service = RedisService()
