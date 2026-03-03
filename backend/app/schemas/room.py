"""Room schemas."""

from datetime import datetime

from pydantic import BaseModel


class RoomCreate(BaseModel):
    name: str
    capacity: int = 0
    location: str = ""
    amenities: list[str] = []


class RoomUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = None
    location: str | None = None
    amenities: list[str] | None = None
    is_active: bool | None = None


class RoomResponse(BaseModel):
    id: int
    name: str
    capacity: int
    location: str
    amenities: list[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
