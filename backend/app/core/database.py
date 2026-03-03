"""
Database engine and session management.
Async SQLAlchemy — SQLite for local dev, PostgreSQL for production.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# ─── Async Engine ────────────────────────────────────────────
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

_engine_kwargs: dict = {
    "echo": False,
}

# Connection pooling only for PostgreSQL (SQLite doesn't support it)
if not _is_sqlite:
    _engine_kwargs.update(
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=300,
    )

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# Enable foreign-key enforcement for SQLite (off by default)
if _is_sqlite:
    from sqlalchemy import event

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# ─── Session Factory ─────────────────────────────────────────
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency: yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            # Routes commit explicitly; only commit here if session has
            # uncommitted changes (belt-and-suspenders).
            if session.in_transaction():
                await session.commit()
        except Exception:
            await session.rollback()
            raise
