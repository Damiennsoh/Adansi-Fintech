"""ADANSI FastAPI application entry point."""
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
    agents_router, ussd_router, whatsapp_router, momo_router
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup
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
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:5173",
        "https://adansi.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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


@app.get("/health")
async def health_check():
    """Simple health check for monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected",
        "redis": "connected" if redis_client else "fallback_mode"
    }
