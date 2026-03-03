"use client";

import { useBookings } from "@/hooks/useBookings";
import { useRooms } from "@/hooks/useRooms";
import { useAuth } from "@/hooks/useAuth";
import { CalendarDays, DoorOpen, Users, Clock } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: bookingsData } = useBookings({ my_bookings: true });
  const { data: rooms } = useRooms();

  const stats = [
    {
      label: "My Bookings",
      value: bookingsData?.total ?? 0,
      icon: CalendarDays,
      color: "bg-blue-500",
    },
    {
      label: "Available Rooms",
      value: rooms?.length ?? 0,
      icon: DoorOpen,
      color: "bg-green-500",
    },
    {
      label: "Today's Meetings",
      value: bookingsData?.bookings?.filter((b) => {
        const today = new Date().toDateString();
        return new Date(b.start_time).toDateString() === today;
      }).length ?? 0,
      icon: Clock,
      color: "bg-purple-500",
    },
    {
      label: "Department",
      value: user?.department ?? "—",
      icon: Users,
      color: "bg-orange-500",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 mb-8">
        Welcome back, {user?.name ?? "User"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex items-center gap-4">
              <div
                className={`${stat.color} p-3 rounded-lg text-white`}
              >
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Upcoming Bookings
        </h2>
        {bookingsData?.bookings && bookingsData.bookings.length > 0 ? (
          <div className="space-y-3">
            {bookingsData.bookings.slice(0, 5).map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{booking.title}</p>
                  <p className="text-sm text-gray-500">
                    {booking.room?.name} &middot;{" "}
                    {new Date(booking.start_time).toLocaleString()} –{" "}
                    {new Date(booking.end_time).toLocaleTimeString()}
                  </p>
                </div>
                <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">
            No upcoming bookings
          </p>
        )}
      </div>
    </div>
  );
}
