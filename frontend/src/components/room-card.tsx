"use client";

import type { Room } from "@/lib/types";
import { MonitorSmartphone } from "lucide-react";
import Link from "next/link";

interface RoomCardProps {
  room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            room.is_active
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {room.is_active ? "Active" : "Inactive"}
        </span>
      </div>



      {room.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {room.amenities.map((a) => (
            <span
              key={a}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md"
            >
              {a.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/dashboard/calendar?room=${room.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <MonitorSmartphone className="h-4 w-4" />
        View Schedule
      </Link>
    </div>
  );
}
