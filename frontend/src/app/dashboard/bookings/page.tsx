"use client";

import { useBookings } from "@/hooks/useBookings";
import { BookingModal } from "@/components/booking-modal";
import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Booking } from "@/lib/types";

const PAGE_SIZE = 15;

export default function BookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data, isLoading } = useBookings({ page, page_size: PAGE_SIZE, search: debouncedSearch || undefined });

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.bookings) return;
    const eligible = data.bookings.filter(
      (b) => b.status !== "completed" && (b.organizer_id === user?.id || user?.is_admin)
    );
    if (eligible.every((b) => selected.has(b.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((b) => b.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const { data: result } = await api.post("/api/bookings/bulk-delete", {
        booking_ids: Array.from(selected),
      });
      toast.success(`${result.cancelled} booking(s) cancelled`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    } catch {
      toast.error("Failed to cancel bookings");
    } finally {
      setBulkDeleting(false);
    }
  };

  const openCreate = () => {
    setEditBooking(null);
    setModalOpen(true);
  };

  const openEdit = (booking: Booking) => {
    setEditBooking(booking);
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditBooking(null);
    setModalOpen(false);
  };

  const handleCancel = async (id: number) => {
    try {
      await api.delete(`/api/bookings/${id}`);
      toast.success("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    } catch {
      toast.error("Failed to cancel booking");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Bookings</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition"
        >
          + New Booking
        </button>
      </div>

      {/* Search Bar & Bulk Actions */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, room, or organizer..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4" />
            Cancel {selected.size} selected
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={
                    !!data?.bookings &&
                    data.bookings.filter(
                      (b) => b.status !== "completed" && (b.organizer_id === user?.id || user?.is_admin)
                    ).length > 0 &&
                    data.bookings
                      .filter((b) => b.status !== "completed" && (b.organizer_id === user?.id || user?.is_admin))
                      .every((b) => selected.has(b.id))
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Room
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Organizer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : data?.bookings && data.bookings.length > 0 ? (
              data.bookings.map((booking) => {
                const canAct = (booking.organizer_id === user?.id || user?.is_admin) && booking.status !== "completed";
                return (
                <tr key={booking.id} className={`hover:bg-gray-50 ${selected.has(booking.id) ? "bg-primary-50" : ""}`}>
                  <td className="px-3 py-4 w-10">
                    {canAct ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={selected.has(booking.id)}
                        onChange={() => toggleSelect(booking.id)}
                      />
                    ) : (
                      <span className="block h-4 w-4" />
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {booking.title}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {booking.room?.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(booking.start_time).toLocaleDateString()}{" "}
                    {new Date(booking.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(booking.end_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {booking.organizer?.name}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        booking.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : booking.status === "completed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canAct && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(booking)}
                          className="text-primary-500 hover:text-primary-700 p-1"
                          title="Edit booking"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCancel(booking.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Cancel booking"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No bookings found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {Math.ceil(data.total / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * PAGE_SIZE >= data.total}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <BookingModal
        open={modalOpen}
        onClose={closeModal}
        editBooking={editBooking}
      />
    </div>
  );
}
