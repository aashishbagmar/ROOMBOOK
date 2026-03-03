"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useBookings } from "@/hooks/useBookings";
import { useRooms } from "@/hooks/useRooms";
import { useState } from "react";
import styles from "./room-calendar.module.css";

interface RoomCalendarProps {
  onDateSelect: (start: Date, end: Date, roomId?: number) => void;
}

const ROOM_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export function RoomCalendar({ onDateSelect }: RoomCalendarProps) {
  const [selectedRoom, setSelectedRoom] = useState<number | undefined>();
  const { data: rooms } = useRooms();
  const { data: bookingsData } = useBookings({
    room_id: selectedRoom,
    page_size: 100,
  });

  const events =
    bookingsData?.bookings?.map((b) => {
      const roomIndex = rooms?.findIndex((r) => r.id === b.room_id) ?? 0;
      const isCompleted = b.status === "completed";
      return {
        id: String(b.id),
        title: `${b.title}${b.room ? ` (${b.room.name})` : ""}${isCompleted ? " ✓" : ""}`,
        start: b.start_time,
        end: b.end_time,
        backgroundColor: isCompleted ? "#9ca3af" : ROOM_COLORS[roomIndex % ROOM_COLORS.length],
        borderColor: isCompleted ? "#6b7280" : ROOM_COLORS[roomIndex % ROOM_COLORS.length],
        extendedProps: { booking: b },
      };
    }) ?? [];

  return (
    <div className={styles.calendar}>
      {/* Room filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedRoom(undefined)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${
            !selectedRoom
              ? "bg-primary-600 text-white border-primary-600"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          All Rooms
        </button>
        {rooms?.map((room, i) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              selectedRoom === room.id
                ? "text-white border-transparent"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
            style={
              selectedRoom === room.id
                ? {
                    backgroundColor: ROOM_COLORS[i % ROOM_COLORS.length],
                  }
                : {}
            }
          >
            {room.name}
          </button>
        ))}
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        selectable
        selectMirror
        events={events}
        select={(info) => {
          onDateSelect(info.start, info.end, selectedRoom);
        }}
        height="auto"
        scrollTime="08:00:00"
        allDaySlot={false}
        nowIndicator
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "08:00",
          endTime: "18:00",
        }}
      />
    </div>
  );
}
