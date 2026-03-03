"use client";

import { useRooms } from "@/hooks/useRooms";
import { RoomCard } from "@/components/room-card";
import { useState } from "react";
import { Search } from "lucide-react";

export default function RoomsPage() {
  const { data: rooms, isLoading } = useRooms();
  const [search, setSearch] = useState("");

  const filtered = rooms?.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search rooms..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl h-48 animate-pulse border border-gray-100"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered?.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
          {filtered?.length === 0 && (
            <p className="text-gray-400 col-span-full text-center py-12">
              No rooms found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
