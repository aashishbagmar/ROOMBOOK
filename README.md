# 🏗 RoomBook — Enterprise Room Booking System

## Architecture

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | Next.js 14 (App Router), TypeScript, Tailwind CSS, FullCalendar, React Query |
| Backend    | FastAPI (Python 3.12), Pydantic v2, async SQLAlchemy |
| Database   | PostgreSQL 16 with GiST exclusion constraint      |
| Cache      | Redis 7                                           |
| Email      | SendGrid (async background)                       |
| Proxy      | Nginx                                             |
| Deploy     | Docker Compose                                    |

## Quick Start

```bash
# 1. Clone and enter
cd ROOMBOOK

# 2. Copy environment file
cp .env.example .env

# 3. Start all services
docker-compose up --build -d

# 4. Open in browser
#    Frontend:  http://localhost:3000
#    API Docs:  http://localhost:8000/api/docs
#    Via Nginx: http://localhost
```

## Default Credentials

| Email                    | Password   | Role  |
|--------------------------|------------|-------|
| admin@roombook.internal  | admin123   | Admin |

## Project Structure

```
ROOMBOOK/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   ├── db/
│   │   └── init.sql              # Schema + seed data
│   └── app/
│       ├── main.py               # FastAPI entry point
│       ├── core/
│       │   ├── config.py         # Pydantic Settings
│       │   ├── database.py       # Async SQLAlchemy engine
│       │   ├── redis.py          # Redis client
│       │   └── security.py       # JWT + bcrypt
│       ├── models/
│       │   ├── user.py
│       │   ├── room.py
│       │   └── booking.py
│       ├── schemas/
│       │   ├── user.py
│       │   ├── room.py
│       │   ├── booking.py
│       │   └── auth.py
│       ├── api/
│       │   ├── deps.py           # Auth dependencies
│       │   └── routes/
│       │       ├── auth.py       # Register / Login
│       │       ├── users.py      # User CRUD
│       │       ├── rooms.py      # Room CRUD
│       │       └── bookings.py   # Booking CRUD + availability
│       └── services/
│           └── email.py          # SendGrid async emails
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── login/page.tsx
│       │   └── dashboard/
│       │       ├── layout.tsx
│       │       ├── page.tsx
│       │       ├── rooms/page.tsx
│       │       ├── calendar/page.tsx
│       │       └── bookings/page.tsx
│       ├── components/
│       │   ├── providers.tsx
│       │   ├── auth-guard.tsx
│       │   ├── sidebar.tsx
│       │   ├── room-card.tsx
│       │   ├── room-calendar.tsx
│       │   └── booking-modal.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useRooms.ts
│       │   └── useBookings.ts
│       └── lib/
│           ├── api.ts
│           ├── types.ts
│           └── utils.ts
└── nginx/
    └── nginx.conf
```

## Double Booking Prevention

### Two-Layer Defense:

**1. Application Level** — Pre-check query before insert:
```python
SELECT * FROM bookings
WHERE room_id = ? AND status = 'confirmed'
  AND start_time < ? AND end_time > ?
```

**2. Database Level** — PostgreSQL exclusion constraint:
```sql
CONSTRAINT no_double_booking
    EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status = 'confirmed')
```

Even if two concurrent requests bypass the app-level check, the database constraint guarantees **zero double bookings**.

## API Endpoints

| Method   | Endpoint                        | Description               |
|----------|---------------------------------|---------------------------|
| POST     | /api/auth/register              | Register new user         |
| POST     | /api/auth/login                 | Login → JWT               |
| GET      | /api/users/me                   | Current user profile      |
| PATCH    | /api/users/me                   | Update profile            |
| GET      | /api/users                      | List all users            |
| GET      | /api/rooms                      | List rooms (filterable)   |
| POST     | /api/rooms                      | Create room (admin)       |
| PATCH    | /api/rooms/:id                  | Update room (admin)       |
| DELETE   | /api/rooms/:id                  | Soft-delete room (admin)  |
| GET      | /api/bookings                   | List bookings (filtered)  |
| POST     | /api/bookings                   | Create booking            |
| GET      | /api/bookings/:id               | Get booking               |
| PATCH    | /api/bookings/:id               | Update booking            |
| DELETE   | /api/bookings/:id               | Cancel booking            |
| GET      | /api/bookings/availability/:id  | Room availability by date |
| GET      | /health                         | Health check              |
