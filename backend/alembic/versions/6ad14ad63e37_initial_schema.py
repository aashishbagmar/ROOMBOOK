"""initial_schema

Revision ID: 6ad14ad63e37
Revises: 
Create Date: 2026-03-03 16:11:11.417089
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '6ad14ad63e37'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("department", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("is_admin", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_users_department", "users", ["department"])

    # Rooms
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("capacity", sa.Integer(), server_default="0"),
        sa.Column("location", sa.String(255), server_default="''"),
        sa.Column("amenities", sa.JSON(), server_default="[]"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_rooms_name", "rooms", ["name"])

    # Bookings
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organizer_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), server_default="confirmed"),
        sa.Column("recurrence_group_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("end_time > start_time", name="chk_booking_time"),
    )
    op.create_index("idx_bookings_room_id", "bookings", ["room_id"])
    op.create_index("idx_bookings_organizer_id", "bookings", ["organizer_id"])
    op.create_index("idx_bookings_start_time", "bookings", ["start_time"])
    op.create_index("idx_bookings_end_time", "bookings", ["end_time"])
    op.create_index("idx_bookings_status", "bookings", ["status"])
    op.create_index("idx_bookings_room_time", "bookings", ["room_id", "start_time", "end_time"])
    op.create_index(
        "idx_bookings_recurrence_group",
        "bookings",
        ["recurrence_group_id"],
        postgresql_where=sa.text("recurrence_group_id IS NOT NULL"),
    )

    # Booking Participants
    op.create_table(
        "booking_participants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("booking_id", "user_id", name="uq_booking_participant"),
    )
    op.create_index("idx_bp_booking_id", "booking_participants", ["booking_id"])
    op.create_index("idx_bp_user_id", "booking_participants", ["user_id"])


def downgrade() -> None:
    op.drop_table("booking_participants")
    op.drop_table("bookings")
    op.drop_table("rooms")
    op.drop_table("users")
