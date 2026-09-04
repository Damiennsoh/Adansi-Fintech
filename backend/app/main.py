"""ADANSI FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.services.redis_service import redis_client
from datetime import datetime
from app.database import init_db
from app.routers import (
    auth_router, users_router, groups_router,
    contributions_router, withdrawals_router, credit_router,
    agents_router, ussd_router, whatsapp_router, momo_router, rates_router, admin_router, history_router
)

logger = logging.getLogger(__name__)

settings = get_settings()

allowed_origins = {
    origin.strip()
    for origin in [
        settings.frontend_url,
        *(settings.frontend_urls.split(',') if settings.frontend_urls else []),
        'http://localhost:3000',
        'http://localhost:5173',
        'https://adansi-fintech.vercel.app',
        'https://adansi.app',
    ]
    if origin and origin.strip()
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Run Alembic migrations on startup (production safety net; render.yaml also runs alembic upgrade head).
    try:
        from alembic.config import Config as AlembicConfig
        from alembic import command as alembic_command
        import os
        alembic_ini = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini")
        if os.path.exists(alembic_ini):
            cfg = AlembicConfig(alembic_ini)
            cfg.set_main_option("script_location", os.path.join(os.path.dirname(alembic_ini), "alembic"))
            alembic_command.upgrade(cfg, "head")
            logger.info("Alembic migrations applied successfully (head)")
        else:
            logger.warning("Alembic ini not found at %s; skipping auto-migration", alembic_ini)
    except Exception as exc:
        logger.exception("Alembic auto-migration failed at startup: %s", exc)

    if settings.debug:
        try:
            await init_db()  # Create tables in dev (use Alembic in production)
        except Exception as e:
            print(f"Database connection warning: {e}. FastAPI server running.")
    yield
    # Shutdown
    # Cleanup connections if needed


app = FastAPI(
    title=settings.app_name,
    description="The Collective Finance Protocol - MTN MoMo Fintech Lab 2026",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS: Allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_origin_regex=r"https:\/\/(.*\.)?(vercel\.app|netlify\.app|githubpreview\.dev)|http:\/\/localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600
)

# Register all routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(groups_router, prefix="/api/v1")
app.include_router(contributions_router, prefix="/api/v1")
app.include_router(withdrawals_router, prefix="/api/v1")
app.include_router(credit_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
app.include_router(ussd_router, prefix="/api/v1")
app.include_router(whatsapp_router, prefix="/api/v1")
app.include_router(momo_router, prefix="/api/v1")
app.include_router(rates_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(history_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Health check / welcome endpoint."""
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "auth": "/api/v1/auth",
            "users": "/api/v1/users",
            "groups": "/api/v1/groups",
            "contributions": "/api/v1/contributions",
            "withdrawals": "/api/v1/withdrawals",
            "credit": "/api/v1/credit",
            "ussd": "/api/v1/ussd",
            "whatsapp": "/api/v1/whatsapp",
            "momo": "/api/v1/momo"
        }
    }


def build_health_status(database_ok: bool = True, redis_ok: bool = True, hubtel_ok: bool | None = None, twilio_ok: bool | None = None):
    """Return a structured health payload based on actual dependency state.

    Unconfigured providers are treated as informational rather than fatal, so local testing can
    continue before credentials are added.
    """
    critical_ok = database_ok and redis_ok
    provider_status = "healthy" if critical_ok else "degraded"

    hubtel_state = "connected" if hubtel_ok is True else "not_configured" if hubtel_ok is None else "disconnected"
    twilio_state = "connected" if twilio_ok is True else "not_configured" if twilio_ok is None else "disconnected"

    return {
        "status": provider_status,
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if database_ok else "disconnected",
        "redis": "connected" if redis_ok else "unavailable",
        "hubtel": hubtel_state,
        "twilio": twilio_state,
    }


@app.get("/health")
async def health_check():
    """Health check for monitoring and deployment probes."""
    database_ok = True
    try:
        await init_db()
    except Exception:
        database_ok = False

    redis_ok = redis_client is not None
    hubtel_ok = None if not settings.hubtel_client_id or not settings.hubtel_client_secret or not settings.hubtel_merchant_id else True
    twilio_ok = None if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_whatsapp_number else True
    return build_health_status(database_ok=database_ok, redis_ok=redis_ok, hubtel_ok=hubtel_ok, twilio_ok=twilio_ok)
