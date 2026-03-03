-- =====================================================================
-- RoomBook Database Initialization
-- PostgreSQL 16
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";   -- Required for EXCLUDE constraint

-- ─── USERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    department  VARCHAR(255),
    is_active   BOOLEAN DEFAULT TRUE,
    is_admin    BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_department ON users (department);

-- ─── ROOMS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    capacity    INTEGER DEFAULT 0,
    location    VARCHAR(255) DEFAULT '',
    amenities   TEXT[] DEFAULT '{}',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_name ON rooms (name);

-- ─── BOOKINGS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
    id              SERIAL PRIMARY KEY,
    room_id         INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    organizer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    status          VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    recurrence_group_id VARCHAR(36),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- ⚠ CRITICAL: Prevent end_time <= start_time
    CONSTRAINT chk_booking_time CHECK (end_time > start_time),

    -- ⚠ CRITICAL: No double booking — database-level exclusion constraint
    -- This uses GiST index to prevent ANY overlapping time ranges for the same room
    -- Even concurrent transactions cannot create overlapping bookings
    CONSTRAINT no_double_booking
        EXCLUDE USING gist (
            room_id WITH =,
            tstzrange(start_time, end_time) WITH &&
        )
        WHERE (status = 'confirmed')
);

CREATE INDEX idx_bookings_room_id ON bookings (room_id);
CREATE INDEX idx_bookings_organizer_id ON bookings (organizer_id);
CREATE INDEX idx_bookings_start_time ON bookings (start_time);
CREATE INDEX idx_bookings_end_time ON bookings (end_time);
CREATE INDEX idx_bookings_status ON bookings (status);

-- Composite index for common query: find bookings for a room in a time range
CREATE INDEX idx_bookings_room_time ON bookings (room_id, start_time, end_time);
CREATE INDEX idx_bookings_recurrence_group ON bookings (recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;

-- ─── BOOKING PARTICIPANTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_participants (
    id          SERIAL PRIMARY KEY,
    booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate participants
    CONSTRAINT uq_booking_participant UNIQUE (booking_id, user_id)
);

CREATE INDEX idx_bp_booking_id ON booking_participants (booking_id);
CREATE INDEX idx_bp_user_id ON booking_participants (user_id);

-- ─── SEED DATA (Development) ────────────────────────────────────────

-- Default admin user (password: admin123)
INSERT INTO users (name, email, password, department, is_admin)
VALUES (
    'Admin User',
    'admin@roombook.internal',
    '$2b$12$LJ3m4ys3GZ6bCOY2I3MvGeA8GrKGOcVKhI4k/kSESmWWcBAcXvzTK',
    'IT',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Sample rooms
INSERT INTO rooms (name, capacity, location, amenities) VALUES
    ('Telephone Room',  0, '', '{}'),
    ('Sinhagad',        0, '', '{}'),
    ('Raigad',          0, '', '{}'),
    ('Torna',           0, '', '{}')
ON CONFLICT (name) DO NOTHING;
