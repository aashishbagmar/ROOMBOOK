"use client";

import dynamic from "next/dynamic";
import { BookingModal } from "@/components/booking-modal";
import { useState } from "react";

const RoomCalendar = dynamic(
  () => import("@/components/room-calendar").then((m) => m.RoomCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-24 text-gray-400">
        Loading calendar…
      </div>
    ),
  }
);

export default function CalendarPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: Date;
    end: Date;
    roomId?: number;
  } | null>(null);

  const handleDateSelect = (start: Date, end: Date, roomId?: number) => {
    setSelectedSlot({ start, end, roomId });
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <button
          onClick={() => {
            setSelectedSlot(null);
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition"
        >
          + New Booking
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <RoomCalendar onDateSelect={handleDateSelect} />
      </div>

      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialStart={selectedSlot?.start}
        initialEnd={selectedSlot?.end}
        initialRoomId={selectedSlot?.roomId}
      />
    </div>
  );
}
