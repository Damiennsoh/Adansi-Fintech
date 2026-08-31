"""Database connection and session management."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
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
