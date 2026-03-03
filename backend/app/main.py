"""
RoomBook - Enterprise Room Booking System
FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.api import router as api_router
from app.core.database import engine, async_session
from app.models import Base  # noqa: F401
from app.models.room import Room
from app.models.user import User
from app.core.security import hash_password
from app.api.routes.bookings import cleanup_bookings

logger = logging.getLogger(__name__)


async def _seed_data():
    """Insert default rooms & admin user if tables are empty."""
    async with async_session() as session:
        # --- Admin user ---
        result = await session.execute(select(User).limit(1))
        if result.scalars().first() is None:
            admin = User(
                name="Admin User",
                email="admin@roombook.internal",
                password=hash_password("admin123"),
                department="IT",
                is_admin=True,
            )
            session.add(admin)

        # --- Rooms: ensure exactly these 4 rooms exist ---
        desired_rooms = ["Telephone Room", "Sinhagad", "Raigad", "Torna"]
        result = await session.execute(select(Room))
        existing_rooms = {r.name: r for r in result.scalars().all()}

        # Deactivate rooms not in the desired list
        for name, room in existing_rooms.items():
            if name not in desired_rooms:
                room.is_active = False

        # Create rooms that don't exist yet
        for name in desired_rooms:
            if name not in existing_rooms:
                session.add(Room(name=name, capacity=0, location="", amenities=[]))

        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup & shutdown."""
    # Validate configuration for production
    settings.validate_secrets()
    logger.info(f"Starting RoomBook API [{settings.ENVIRONMENT}]")
    # Startup — create tables if they don't exist (for SQLite dev mode)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed default data
    await _seed_data()
    # Run booking cleanup: mark past bookings as completed & delete >2 months old
    async with async_session() as session:
        await cleanup_bookings(session)
    logger.info("Startup complete")
    yield
    # Shutdown
    logger.info("Shutting down")
    await engine.dispose()


app = FastAPI(
    title="RoomBook API",
    description="Enterprise Internal Room Booking System",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=True,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ─── CORS ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ──────────────────────────────────────────────────
app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "roombook-api"}
