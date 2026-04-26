import logging
from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


# Pairs of (table, column DDL) appended to existing tables on boot. SQLite does
# not support full migrations without an external tool, so we apply additive
# `ALTER TABLE` statements idempotently when the column doesn't already exist.
_LIGHTWEIGHT_MIGRATIONS: tuple[tuple[str, str, str], ...] = (
    ("users", "banner_url", "ALTER TABLE users ADD COLUMN banner_url VARCHAR(512)"),
    (
        "users",
        "history_enabled",
        "ALTER TABLE users ADD COLUMN history_enabled BOOLEAN NOT NULL DEFAULT 1",
    ),
    ("users", "last_seen_at", "ALTER TABLE users ADD COLUMN last_seen_at DATETIME"),
)


async def _apply_lightweight_migrations() -> None:
    async with engine.begin() as conn:
        for table, column, ddl in _LIGHTWEIGHT_MIGRATIONS:
            res = await conn.execute(text(f"PRAGMA table_info({table})"))
            existing = {row[1] for row in res.fetchall()}
            if column in existing:
                continue
            try:
                await conn.execute(text(ddl))
                logger.info("applied migration: %s", ddl)
            except Exception as exc:  # noqa: BLE001
                logger.warning("migration %s failed: %s", ddl, exc)


async def init_db() -> None:
    # Import models so metadata is populated
    from app import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _apply_lightweight_migrations()
