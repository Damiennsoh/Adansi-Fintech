"""ADANSI FastAPI application entry point."""
import json
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.services.redis_service import redis_client
from datetime import datetime
from app.database import init_db, patch_users_table, diagnose_users_columns
from app.routers import (
    auth_router, users_router, groups_router,
    contributions_router, withdrawals_router, credit_router,
    agents_router, ussd_router, whatsapp_router, momo_router, rates_router, admin_router, history_router
)

# Force INFO-level logging + propagate to stdout.
# Render captures stdout/stderr; default Uvicorn logging config leaves
# non-`uvicorn.*` loggers at WARN so our lifespan/register_user logs were silent.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("app.main")

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
    # ---- (1) Bootstrap DDL patcher ----------------------------------------
    # This runs BEFORE alembic and BEFORE init_db and uses raw PostgreSQL.
    # It CANNOT be bypassed (unlike render.yaml startCommand or alembic runs).
    print("[startup] Running patch_users_table() ...", flush=True)
    try:
        patch = await patch_users_table()
        print(f"[startup] patch_users_table applied={len(patch['applied'])} "
              f"skipped={len(patch['skipped'])}", flush=True)
        for ddl in patch["applied"]:
            print(f"[startup] patch_users_table APPLIED: {ddl}", flush=True)
        for note in patch["skipped"]:
            print(f"[startup] patch_users_table SKIPPED: {note}", flush=True)
        logger.info("patch_users_table result: %s", patch)
    except Exception as exc:
        print(f"[startup] patch_users_table FAILED: {exc}", flush=True)
        logger.exception("patch_users_table FAILED")

    # ---- (2) Alembic -------------------------------------------------------
    try:
        from alembic.config import Config as AlembicConfig
        from alembic import command as alembic_command
        import os
        backend_dir = os.path.dirname(os.path.dirname(__file__))
        alembic_ini = os.path.join(backend_dir, "alembic.ini")
        if os.path.exists(alembic_ini):
            print("[startup] Running alembic upgrade head ...", flush=True)
            cfg = AlembicConfig(alembic_ini)
            cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
            alembic_command.upgrade(cfg, "head")
            print("[startup] Alembic migrations applied successfully (head)", flush=True)
            logger.info("Alembic migrations applied successfully (head)")
        else:
            print(f"[startup] Alembic ini not found at {alembic_ini}; skipping auto-migration", flush=True)
            logger.warning("Alembic ini not found at %s; skipping auto-migration", alembic_ini)
    except Exception as exc:
        print(f"[startup] Alembic auto-migration failed: {exc}", flush=True)
        logger.exception("Alembic auto-migration failed at startup: %s", exc)

    # ---- (3) Dev table creation -------------------------------------------
    if settings.debug:
        try:
            await init_db()  # Create tables in dev (use Alembic in production)
        except Exception as e:
            print(f"Database connection warning: {e}. FastAPI server running.", flush=True)
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
    users_cols = {}
    try:
        await init_db()
    except Exception:
        database_ok = False
    try:
        users_cols = await diagnose_users_columns()
    except Exception as exc:
        users_cols = {"error": str(exc)}

    redis_ok = redis_client is not None
    hubtel_ok = None if not settings.hubtel_client_id or not settings.hubtel_client_secret or not settings.hubtel_merchant_id else True
    twilio_ok = None if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_whatsapp_number else True
    status = build_health_status(database_ok=database_ok, redis_ok=redis_ok, hubtel_ok=hubtel_ok, twilio_ok=twilio_ok)
    status["users_columns"] = users_cols
    # High-level schema_ok computed from returned dict.
    if isinstance(users_cols, dict) and "error" not in users_cols:
        missing = [name for name, info in users_cols.items()
                   if isinstance(info, dict) and not info.get("exists")]
        non_nullable_violations = [name for name, info in users_cols.items()
                                   if isinstance(info, dict) and info.get("exists") and
                                   name in ("phone", "email", "auth_user_id", "pin_hash",
                                            "ghana_card_number", "ghana_card_image_url")
                                   and info.get("nullable") is False]
        status["schema_ok"] = not missing and not non_nullable_violations
        status["missing_columns"] = missing
        status["non_nullable_violations"] = non_nullable_violations
    return status


@app.get("/health/db-schema")
async def health_db_schema():
    """Diagnostic endpoint: inspects the deployed users table columns vs what User() expects.

    Returns each column with `exists`, `nullable`, `default`.
    `missing_columns` are columns that don't exist.
    `non_nullable_violations` are columns that exist but are NOT NULL in Postgres
    while the Python `User()` model declares them nullable (e.g. phone for email-diaspora signup).
    """
    cols = await diagnose_users_columns()
    if isinstance(cols, dict) and "error" in cols:
        return cols
    missing = [name for name, info in cols.items() if not info.get("exists")]
    non_nullable_violations = [name for name, info in cols.items()
                               if info.get("exists") and
                               name in ("phone", "email", "auth_user_id", "pin_hash",
                                        "ghana_card_number", "ghana_card_image_url")
                               and info.get("nullable") is False]
    return {
        "users_table": cols,
        "missing_columns": missing,
        "non_nullable_violations": non_nullable_violations,
        "schema_ok": not missing and not non_nullable_violations,
    }


@app.get("/health/build-info")
async def health_build_info():
    """Diagnostic: identify which code version is currently deployed on Render.

    If `build.commit` shows a SHA other than your latest push, Render has not
    picked up the new deploy (check auto-deploy branch on the dashboard).
    """
    import os
    info = {
        "known_commits_expected_tail": [
            "e3cf58f (ddl-patch-import-fix)",
            "c53b3b9 (ddl-patcher + db-schema)",
            "a4709e2 (alembic + surface SQL errors)",
        ],
        "cwd": os.getcwd(),
        "app_main_file": __file__,
    }
    try:
        from app.database import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            pgver = await conn.execute(text("SELECT version()"))
            info["postgres_version"] = pgver.scalar()[:80] if pgver else None
    except Exception as exc:
        info["postgres_version"] = f"error: {exc}"
    return info


@app.post("/debug/register-dry-run")
async def debug_register_dry_run(payload: dict):
    """Perform the EXACT users-table INSERT that `register_user` does, but inside a
    SAVEPOINT that is always rolled back. Returns the raw, complete SQL error (if any)
    without requiring any auth.py code changes.

    Usage: POST JSON with {full_name, email?, phone?, pin?, ghana_card_number?}
    """
    from app.database import AsyncSessionLocal
    from sqlalchemy import text
    import traceback

    full_name = str(payload.get("full_name", "")).strip()
    email = str(payload.get("email", "")).strip()
    email = email.lower() if email else None
    phone = str(payload.get("phone", "")).strip() or None
    pin = str(payload.get("pin", "123456")).strip()
    ghana_card = (
        str(payload.get("ghana_card_number", "")).strip().upper() or None
    )

    result = {
        "input": {
            "full_name": full_name, "email": email,
            "phone": phone, "ghana_card_number": ghana_card,
            "pin_length": len(pin),
        },
        "steps": [],
    }

    async with AsyncSessionLocal() as s:
        async with s.begin_nested():
            try:
                from app.models import User
                from app.services.auth_service import auth_service
                u = User(
                    auth_user_id=None,
                    phone=phone,
                    email=email,
                    full_name=full_name,
                    ghana_card_number=ghana_card,
                    pin_hash=auth_service.hash_pin(pin),
                    is_verified=False,
                )
                s.add(u)
                result["steps"].append("User() constructed")
                await s.flush()
                result["steps"].append(f"flush ok, id={u.id}")
                # Inspect by raw SQL the inserted row
                rows = await s.execute(text("SELECT id, phone, email, full_name, ghana_card_number FROM users WHERE id = :uid"), {"uid": str(u.id)})
                result["inserted_row"] = [dict(r._mapping) for r in rows.all()]
                raise RuntimeError("__dry_run_rollback__")
            except RuntimeError as rte:
                if str(rte) == "__dry_run_rollback__":
                    result["success"] = True
                    result["verdict"] = "Dry-run INSERT succeeded. No DB error — real signup failure is elsewhere (Supabase Auth / HTTP validation / pre-insert code)."
                else:
                    raise
            except Exception as exc:
                result["success"] = False
                result["verdict"] = "INSERT FAILED inside SAVEPOINT — this is the real DB error."
                result["error_type"] = type(exc).__name__
                result["error_str"] = str(exc)
                result["error_tb"] = traceback.format_exc(limit=12)
        return result

