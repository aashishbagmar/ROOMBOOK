"""
Booking routes — CRUD with double-booking prevention.

Double-booking is prevented at TWO levels:
  1. Application level: pre-check query before insert
  2. Database level:    EXCLUDE USING gist constraint (see init.sql)

Even if 2 requests slip past the app-level check simultaneously,
the PostgreSQL exclusion constraint will reject the second insert.
"""

from datetime import datetime, timedelta, timezone, date
from dateutil.relativedelta import relativedelta
import uuid as _uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_, update, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.booking import Booking, BookingParticipant
from app.models.room import Room
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingUpdate,
    BookingListResponse,
    BulkDeleteRequest,
    RecurringBookingResponse,
)
from app.services.email import send_booking_confirmation

router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────

async def _check_room_exists(db: AsyncSession, room_id: int) -> Room:
    result = await db.execute(select(Room).where(Room.id == room_id, Room.is_active == True))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


async def _load_booking_with_rels(db: AsyncSession, booking_id: int) -> Booking:
    """Re-fetch a booking with room, organizer, participants eagerly loaded."""
    result = await db.execute(
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            joinedload(Booking.room),
            joinedload(Booking.organizer),
            joinedload(Booking.participants).joinedload(BookingParticipant.user),
        )
    )
    return result.unique().scalar_one()


async def _check_overlap(
    db: AsyncSession,
    room_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_booking_id: int | None = None,
):
    """Application-level overlap check (first line of defense)."""
    query = select(Booking).where(
        and_(
            Booking.room_id == room_id,
            Booking.status == "confirmed",
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
    )
    if exclude_booking_id:
        query = query.where(Booking.id != exclude_booking_id)

    result = await db.execute(query)
    conflicting = result.scalar_one_or_none()
    if conflicting:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Room is already booked for this time slot",
                "conflicting_booking": {
                    "id": conflicting.id,
                    "title": conflicting.title,
                    "start_time": conflicting.start_time.isoformat(),
                    "end_time": conflicting.end_time.isoformat(),
                },
            },
        )


# ─── CREATE ──────────────────────────────────────────────────

async def _create_single_booking(
    db: AsyncSession,
    room: Room,
    current_user: User,
    payload: BookingCreate,
    start: datetime,
    end: datetime,
    recurrence_group_id: str | None = None,
) -> Booking | None:
    """Create one booking. Returns None if overlap detected (for recurring skip)."""
    booking = Booking(
        room_id=payload.room_id,
        organizer_id=current_user.id,
        title=payload.title,
        description=payload.description,
        start_time=start,
        end_time=end,
        recurrence_group_id=recurrence_group_id,
    )
    db.add(booking)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return None

    # Add participants
    if payload.participant_ids:
        for user_id in payload.participant_ids:
            db.add(BookingParticipant(booking_id=booking.id, user_id=user_id))
        await db.flush()

    return booking


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new booking (single or recurring).

    For recurring bookings, creates one booking per selected day
    between start_date and repeat_until. Conflicting slots are skipped.
    """
    # ── Normalise datetimes to naive (wall-clock) ─────────────
    payload.start_time = payload.start_time.replace(tzinfo=None)
    payload.end_time = payload.end_time.replace(tzinfo=None)

    # Validate room exists
    room = await _check_room_exists(db, payload.room_id)

    # Validate booking is in the future
    if payload.start_time < datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book in the past",
        )

    # ── Non-recurring (original flow) ─────────────────────────
    if not payload.is_recurring:
        await _check_overlap(db, payload.room_id, payload.start_time, payload.end_time)
        booking = await _create_single_booking(
            db, room, current_user, payload, payload.start_time, payload.end_time
        )
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Room is already booked for this time slot",
            )
        await db.commit()
        booking = await _load_booking_with_rels(db, booking.id)
        background_tasks.add_task(
            send_booking_confirmation,
            booking_id=booking.id,
            organizer_email=current_user.email,
            room_name=room.name,
            title=booking.title,
            start_time=booking.start_time,
            end_time=booking.end_time,
        )
        return booking

    # ── Recurring bookings ────────────────────────────────────
    group_id = str(_uuid.uuid4())
    start_date = payload.start_time.date()
    end_date = payload.repeat_until  # already validated in schema
    time_start = payload.start_time.time()
    time_end = payload.end_time.time()
    duration = payload.end_time - payload.start_time

    # Python weekday: 0=Mon..6=Sun (same as our recurring_days)
    created_bookings: list[Booking] = []
    skipped_dates: list[str] = []

    current = start_date
    while current <= end_date:
        if current.weekday() in payload.recurring_days:
            slot_start = datetime.combine(current, time_start)
            slot_end = slot_start + duration

            # Check overlap — skip silently if conflict
            try:
                await _check_overlap(db, payload.room_id, slot_start, slot_end)
            except HTTPException:
                skipped_dates.append(current.isoformat())
                current += timedelta(days=1)
                continue

            booking = await _create_single_booking(
                db, room, current_user, payload, slot_start, slot_end, group_id
            )
            if booking:
                created_bookings.append(booking)
            else:
                skipped_dates.append(current.isoformat())

        current += timedelta(days=1)

    if not created_bookings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All recurring slots conflict with existing bookings",
        )

    await db.commit()

    # Re-fetch all bookings with relationships for response
    loaded_bookings = []
    for b in created_bookings:
        loaded_bookings.append(await _load_booking_with_rels(db, b.id))

    return RecurringBookingResponse(
        created=len(created_bookings),
        skipped=len(skipped_dates),
        skipped_dates=skipped_dates,
        recurrence_group_id=group_id,
        bookings=loaded_bookings,
    )


# ─── CLEANUP HELPERS ─────────────────────────────────────────

async def _mark_completed_bookings(db: AsyncSession):
    """Mark all past confirmed bookings as 'completed'."""
    now = datetime.now()
    await db.execute(
        update(Booking)
        .where(
            Booking.status == "confirmed",
            Booking.end_time < now,
        )
        .values(status="completed")
    )


async def _delete_old_bookings(db: AsyncSession):
    """Delete bookings older than 2 months."""
    cutoff = datetime.now() - relativedelta(months=2)
    await db.execute(
        delete(Booking).where(Booking.end_time < cutoff)
    )


async def cleanup_bookings(db: AsyncSession):
    """Run all booking maintenance tasks (commits the session)."""
    await _mark_completed_bookings(db)
    await _delete_old_bookings(db)
    await db.commit()


# ─── LIST ────────────────────────────────────────────────────

@router.get("", response_model=BookingListResponse)
async def list_bookings(
    room_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = Query(default=None, max_length=100),
    my_bookings: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List bookings with optional filters and pagination."""
    # Mark past confirmed bookings as completed (inline, no separate commit)
    now = datetime.now()
    await db.execute(
        update(Booking)
        .where(Booking.status == "confirmed", Booking.end_time < now)
        .values(status="completed")
    )
    # Delete bookings older than 2 months
    two_months_ago = now - relativedelta(months=2)
    await db.execute(delete(Booking).where(Booking.end_time < two_months_ago))
    await db.flush()

    query = select(Booking).where(
        Booking.status.in_(["confirmed", "completed"]),
        Booking.end_time >= two_months_ago,
    )

    if room_id:
        query = query.where(Booking.room_id == room_id)
    if start_date:
        query = query.where(Booking.start_time >= start_date)
    if end_date:
        query = query.where(Booking.end_time <= end_date)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Booking.title.ilike(pattern),
                Booking.room.has(Room.name.ilike(pattern)),
                Booking.organizer.has(User.name.ilike(pattern)),
            )
        )
    if my_bookings:
        query = query.where(Booking.organizer_id == current_user.id)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Paginate — use joinedload to fetch room + organizer in a single query
    query = (
        query.order_by(Booking.start_time)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(
            joinedload(Booking.room),
            joinedload(Booking.organizer),
            joinedload(Booking.participants).joinedload(BookingParticipant.user),
        )
    )
    result = await db.execute(query)
    bookings = result.unique().scalars().all()

    return BookingListResponse(bookings=bookings, total=total)


# ─── GET ONE ─────────────────────────────────────────────────

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get a booking by ID."""
    result = await db.execute(
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            joinedload(Booking.room),
            joinedload(Booking.organizer),
            joinedload(Booking.participants).joinedload(BookingParticipant.user),
        )
    )
    booking = result.unique().scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


# ─── UPDATE ──────────────────────────────────────────────────

@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a booking (organizer only)."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a completed booking",
        )
    if booking.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Normalise incoming datetimes to naive (wall-clock)
    if payload.start_time:
        payload.start_time = payload.start_time.replace(tzinfo=None)
    if payload.end_time:
        payload.end_time = payload.end_time.replace(tzinfo=None)

    # If time is changing, check for overlaps
    new_start = payload.start_time or booking.start_time
    new_end = payload.end_time or booking.end_time

    if payload.start_time or payload.end_time:
        await _check_overlap(db, booking.room_id, new_start, new_end, exclude_booking_id=booking.id)

    # Apply updates
    update_data = payload.model_dump(exclude_unset=True, exclude={"participant_ids"})
    for field, value in update_data.items():
        setattr(booking, field, value)

    # Update participants if provided
    if payload.participant_ids is not None:
        # Remove existing
        for p in booking.participants:
            await db.delete(p)
        await db.flush()
        # Add new
        for user_id in payload.participant_ids:
            db.add(BookingParticipant(booking_id=booking.id, user_id=user_id))

    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        if "no_double_booking" in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Room is already booked for this time slot",
            )
        raise

    await db.commit()
    # Evict stale cached booking so joinedload re-fetches room & organizer
    booking_id_val = booking.id
    db.expunge(booking)
    booking = await _load_booking_with_rels(db, booking_id_val)
    return booking


# ─── BULK DELETE ─────────────────────────────────────────────

@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_bookings(
    payload: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel multiple bookings at once."""
    result = await db.execute(
        select(Booking).where(Booking.id.in_(payload.booking_ids))
    )
    bookings = result.scalars().all()

    cancelled = 0
    skipped = 0
    for booking in bookings:
        if booking.status == "completed":
            skipped += 1
            continue
        if booking.organizer_id != current_user.id and not current_user.is_admin:
            skipped += 1
            continue
        booking.status = "cancelled"
        cancelled += 1

    await db.flush()
    await db.commit()
    return {"cancelled": cancelled, "skipped": skipped}


# ─── CANCEL ──────────────────────────────────────────────────

@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a booking (soft delete — sets status to 'cancelled')."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed booking",
        )
    if booking.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    booking.status = "cancelled"
    await db.flush()
    await db.commit()


# ─── ROOM AVAILABILITY ──────────────────────────────────────

@router.get("/availability/{room_id}")
async def check_availability(
    room_id: int,
    date: datetime = Query(..., description="Date to check (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get all bookings for a room on a given date."""
    await _check_room_exists(db, room_id)

    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)

    result = await db.execute(
        select(Booking)
        .where(
            Booking.room_id == room_id,
            Booking.status == "confirmed",
            Booking.start_time <= end_of_day,
            Booking.end_time >= start_of_day,
        )
        .order_by(Booking.start_time)
    )
    bookings = result.scalars().all()

    return {
        "room_id": room_id,
        "date": date.date().isoformat(),
        "bookings": [
            {
                "id": b.id,
                "title": b.title,
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
            }
            for b in bookings
        ],
    }
