"""Booking schemas."""

import uuid
from datetime import datetime, date

from pydantic import BaseModel, Field, model_validator

from app.schemas.user import UserResponse
from app.schemas.room import RoomResponse


class BookingCreate(BaseModel):
    room_id: int
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    start_time: datetime
    end_time: datetime
    participant_ids: list[uuid.UUID] = []
    # Recurring fields
    is_recurring: bool = False
    recurring_days: list[int] = []  # 0=Mon, 1=Tue, ..., 6=Sun (ISO weekday - 1)
    repeat_until: date | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if self.is_recurring:
            if not self.recurring_days:
                raise ValueError("recurring_days required when is_recurring is True")
            if not self.repeat_until:
                raise ValueError("repeat_until required when is_recurring is True")
            if self.repeat_until <= self.start_time.date():
                raise ValueError("repeat_until must be after start date")
            invalid = [d for d in self.recurring_days if d < 0 or d > 6]
            if invalid:
                raise ValueError("recurring_days must be 0-6 (Mon-Sun)")
        return self


class BulkDeleteRequest(BaseModel):
    booking_ids: list[int] = Field(min_length=1, max_length=100)


class BookingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    participant_ids: list[uuid.UUID] | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ParticipantResponse(BaseModel):
    id: int
    user: UserResponse

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    id: int
    room_id: int
    organizer_id: uuid.UUID
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    status: str
    recurrence_group_id: str | None = None
    created_at: datetime
    room: RoomResponse
    organizer: UserResponse
    participants: list[ParticipantResponse] = []

    model_config = {"from_attributes": True}


class RecurringBookingResponse(BaseModel):
    created: int
    skipped: int
    skipped_dates: list[str] = []
    recurrence_group_id: str
    bookings: list[BookingResponse]


class BookingListResponse(BaseModel):
    bookings: list[BookingResponse]
    total: int
