"""
API Router — aggregates all route modules.
"""

from fastapi import APIRouter

from app.api.routes import auth, users, rooms, bookings

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(users.router, prefix="/users", tags=["Users"])
router.include_router(rooms.router, prefix="/rooms", tags=["Rooms"])
router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
