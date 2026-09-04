"""Database connection and session management."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()

# SQLAlchemy async engine connected to Supabase PostgreSQL
# NullPool is recommended for serverless/connection-limited environments like Supabase
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    poolclass=NullPool,
    future=True
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Base class for all models
Base = declarative_base()


async def get_db():
    """FastAPI dependency: yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables (dev only). Production schema: supabase/migrations/."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ---- Bootstrap-style column patcher ------------------------------------------------
# Runs raw PostgreSQL `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` DDL on startup.
# This is the last-resort safety net: it works even when alembic is not invoked
# (e.g. Render dashboard start command overrides render.yaml) or migrations were
# never run on an older deployment.  Each `ADD COLUMN IF NOT EXISTS` is a no-op
# when the column already exists, so re-running is 100% safe.

_USERS_PATCHES = [
    ("auth_user_id", "UUID NULL"),
    ("email", "VARCHAR(255) NULL"),
    ("ghana_card_number", "VARCHAR(20) NULL"),
    ("ghana_card_image_url", "VARCHAR(500) NULL"),
    ("credit_score", "INTEGER NOT NULL DEFAULT 0"),
    ("total_contributed", "DECIMAL(15,2) NOT NULL DEFAULT 0"),
    ("groups_count", "INTEGER NOT NULL DEFAULT 0"),
    ("pin_hash", "VARCHAR(255) NULL"),
    ("role", "VARCHAR(20) NOT NULL DEFAULT 'user'"),
    ("is_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("is_active", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("full_name", "VARCHAR(100) NOT NULL DEFAULT ''"),
    ("created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
    ("updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
]

# Columns that must also be checked for NULLABLE even when they always exist
# (e.g. "phone" was created NOT NULL in the initial bootstrap but the User
#  Python model declares it nullable to support diaspora email-only signups).
_USERS_EXPECTED_NULLABLE = ["phone", "email", "ghana_card_number",
                            "ghana_card_image_url", "pin_hash", "auth_user_id"]

_USERS_INDEXES = [
    ("ix_users_auth_user_id", "users(auth_user_id)", True),
    ("ix_users_email", "users(email)", True),
    ("ix_users_phone", "users(phone)", True),
]


def _nullability_from_def(col_def: str) -> bool:
    """Return True if the column spec in _USERS_PATCHES expects NULLABLE."""
    return "NOT NULL" not in col_def.upper()


async def patch_users_table() -> dict:
    """Ensure every column the `User` model declares exists in the deployed DB.

    Returns a dict with `applied: list[str]` naming the DDL statements that
    actually ran (not the no-ops) so startup logs prove which columns were added.
    """
    applied = []
    skipped = []
    async with engine.begin() as conn:
        exists_row = await conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='users')"
        ))
        if not exists_row.scalar():
            skipped.append("users table does not exist yet; Base.metadata.create_all will create it fully")
            return {"applied": applied, "skipped": skipped}

        # ---- (1) Add missing columns ------------------------------------------------
        for col_name, col_def in _USERS_PATCHES:
            check = await conn.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='users' AND column_name=:c"
            ), {"c": col_name})
            if check.fetchone():
                continue
            ddl = f'ALTER TABLE users ADD COLUMN "{col_name}" {col_def}'
            await conn.execute(text(ddl))
            applied.append(ddl)

        # ---- (2) Fix nullability for columns that already exist but are NOT NULL ---
        # Build a map of {column_name: expected_nullable}.
        expected_nullable = {
            col: _nullability_from_def(defn)
            for col, defn in _USERS_PATCHES
        }
        for col in _USERS_EXPECTED_NULLABLE:
            expected_nullable.setdefault(col, True)

        cur = await conn.execute(text(
            "SELECT column_name, is_nullable, column_default "
            "FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='users'"
        ))
        for col_name, is_nullable, column_default in cur.all():
            want_nullable = expected_nullable.get(col_name)
            if want_nullable is None:
                continue
            actually_nullable = is_nullable.upper() == "YES"
            if want_nullable and not actually_nullable:
                ddl = f'ALTER TABLE users ALTER COLUMN "{col_name}" DROP NOT NULL'
                try:
                    await conn.execute(text(ddl))
                    applied.append(ddl)
                except Exception as exc:
                    skipped.append(f"{ddl} -- failed: {exc}")
            # Ensure defaults are applied if declared.
            matching = [d for c, d in _USERS_PATCHES if c == col_name]
            if matching and "DEFAULT" in matching[0].upper() and not column_default:
                try:
                    tokens = matching[0].split()
                    default_start = next(
                        i for i, tok in enumerate(tokens) if tok.upper() == "DEFAULT"
                    )
                    default_clause = " ".join(tokens[default_start + 1:]).rstrip(";")
                    ddl_def = f'ALTER TABLE users ALTER COLUMN "{col_name}" SET DEFAULT {default_clause}'
                    await conn.execute(text(ddl_def))
                    applied.append(ddl_def)
                except StopIteration:
                    pass
                except Exception as exc:
                    skipped.append(f"set default on {col_name} -- failed: {exc}")

        # ---- (3) Add / repair indexes ----------------------------------------------
        for idx_name, idx_def, unique in _USERS_INDEXES:
            check = await conn.execute(text(
                "SELECT 1 FROM pg_indexes "
                "WHERE schemaname='public' AND indexname=:i"
            ), {"i": idx_name})
            if check.fetchone():
                continue
            unique_sql = "UNIQUE" if unique else ""
            ddl = f"CREATE {unique_sql} INDEX IF NOT EXISTS {idx_name} ON {idx_def}"
            try:
                await conn.execute(text(ddl))
                applied.append(ddl)
            except Exception as exc:
                skipped.append(f"{ddl} -- failed: {exc}")

    return {"applied": applied, "skipped": skipped}


async def diagnose_users_columns() -> dict:
    """Return which User-model columns currently exist in the DB.

    Exposed via /health/db-schema so we can confirm schema state without
    needing to trigger a signup + rollback.
    """
    cols: dict = {name: {"exists": False, "nullable": None, "default": None}
                  for name, _ in _USERS_PATCHES}
    for col in _USERS_EXPECTED_NULLABLE:
        cols.setdefault(col, {"exists": False, "nullable": None, "default": None})
    try:
        async with engine.begin() as conn:
            rows = await conn.execute(text(
                "SELECT column_name, is_nullable, column_default "
                "FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='users'"
            ))
            for (col, nullable, default) in rows.all():
                if col in cols:
                    cols[col] = {
                        "exists": True,
                        "nullable": (nullable or "").upper() == "YES",
                        "default": default,
                    }
    except Exception as exc:
        return {"error": str(exc)}
    return cols

