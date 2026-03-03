"use client";

import { useState, useEffect } from "react";
import { useRooms } from "@/hooks/useRooms";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { X, Repeat } from "lucide-react";
import type { Booking, BookingCreate } from "@/lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  initialStart?: Date;
  initialEnd?: Date;
  initialRoomId?: number;
  /** Pass an existing booking to enter edit mode */
  editBooking?: Booking | null;
}

export function BookingModal({
  open,
  onClose,
  initialStart,
  initialEnd,
  initialRoomId,
  editBooking,
}: BookingModalProps) {
  const queryClient = useQueryClient();
  const { data: rooms } = useRooms();
  const [loading, setLoading] = useState(false);
  const isEdit = !!editBooking;

  const formatDateTime = (d?: Date | string) => {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [form, setForm] = useState({
    room_id: 0,
    title: "",
    description: "",
    start_time: "",
    end_time: "",
  });

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [repeatUntil, setRepeatUntil] = useState("");

  useEffect(() => {
    if (editBooking) {
      setForm({
        room_id: editBooking.room_id,
        title: editBooking.title,
        description: editBooking.description ?? "",
        start_time: formatDateTime(editBooking.start_time),
        end_time: formatDateTime(editBooking.end_time),
      });
      setIsRecurring(false);
      setRecurringDays([]);
      setRepeatUntil("");
    } else {
      setForm({
        room_id: initialRoomId ?? 0,
        title: "",
        description: "",
        start_time: formatDateTime(initialStart),
        end_time: formatDateTime(initialEnd),
      });
      setIsRecurring(false);
      setRecurringDays([]);
      setRepeatUntil("");
    }
  }, [editBooking, initialStart, initialEnd, initialRoomId, open]);

  const toggleDay = (day: number) => {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.room_id) {
      toast.error("Please select a room");
      return;
    }
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      toast.error("Please enter valid start and end times");
      return;
    }
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }
    if (!isEdit && start < new Date()) {
      toast.error("Cannot book in the past");
      return;
    }

    if (isRecurring) {
      if (recurringDays.length === 0) {
        toast.error("Please select at least one day for recurrence");
        return;
      }
      if (!repeatUntil) {
        toast.error("Please set a 'Repeat until' date");
        return;
      }
      if (new Date(repeatUntil) <= start) {
        toast.error("'Repeat until' must be after the start date");
        return;
      }
    }

    // Convert local datetime to timezone-aware ISO string
    const toISOString = (localDateTime: string) => {
      return new Date(localDateTime).toISOString();
    };

    setLoading(true);

    try {
      if (isEdit) {
        // ── PATCH (edit) ───────────────────────────
        await api.patch(`/api/bookings/${editBooking!.id}`, {
          title: form.title,
          description: form.description || null,
          start_time: toISOString(form.start_time + ":00"),
          end_time: toISOString(form.end_time + ":00"),
        });

        // Also create recurring copies if recurring is toggled
        if (isRecurring) {
          const recurPayload: BookingCreate = {
            room_id: form.room_id,
            title: form.title,
            description: form.description || undefined,
            start_time: toISOString(form.start_time + ":00"),
            end_time: toISOString(form.end_time + ":00"),
            is_recurring: true,
            recurring_days: recurringDays,
            repeat_until: repeatUntil,
          };
          const { data: recurData } = await api.post("/api/bookings", recurPayload);
          const msg =
            `Booking updated. Created ${recurData.created} recurring booking(s)` +
            (recurData.skipped > 0 ? `, ${recurData.skipped} skipped (conflicts)` : "");
          toast.success(msg);
        } else {
          toast.success("Booking updated!");
        }
      } else {
        // ── POST (create) ──────────────────────────
        const payload: BookingCreate = {
          room_id: form.room_id,
          title: form.title,
          description: form.description || undefined,
          start_time: toISOString(form.start_time + ":00"),
          end_time: toISOString(form.end_time + ":00"),
        };

        if (isRecurring) {
          payload.is_recurring = true;
          payload.recurring_days = recurringDays;
          payload.repeat_until = repeatUntil;
        }

        const { data } = await api.post("/api/bookings", payload);

        if (isRecurring && data.created !== undefined) {
          const msg =
            `Created ${data.created} booking(s)` +
            (data.skipped > 0 ? `, ${data.skipped} skipped (conflicts)` : "");
          toast.success(msg);
        } else {
          toast.success("Booking created!");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (status === 409) {
        // ── Conflict — room already booked ──────────────────
        if (typeof detail === "object" && detail?.conflicting_booking) {
          const cb = detail.conflicting_booking;
          const fmtTime = (iso: string) =>
            new Date(iso).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          toast.error(
            `This room is already booked from ${fmtTime(cb.start_time)} to ${fmtTime(cb.end_time)}. Please choose another time.`,
            { duration: 6000 }
          );
        } else {
          toast.error(
            "This time slot is already booked. Please choose another time.",
            { duration: 5000 }
          );
        }
      } else if (Array.isArray(detail)) {
        const messages = detail.map((d: any) => d.msg || "Validation error");
        toast.error(messages.join(". "));
      } else if (typeof detail === "object" && detail?.message) {
        toast.error(detail.message);
      } else if (typeof detail === "string") {
        toast.error(detail);
      } else {
        toast.error(isEdit ? "Failed to update booking" : "Failed to create booking");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? "Edit Booking" : "New Booking"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Room */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room
            </label>
            <select
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              value={form.room_id}
              onChange={(e) =>
                setForm({ ...form, room_id: Number(e.target.value) })
              }
            >
              <option value={0}>Select a room</option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              maxLength={255}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Sprint Planning"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Meeting agenda, notes..."
            />
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                value={form.start_time}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                value={form.end_time}
                onChange={(e) =>
                  setForm({ ...form, end_time: e.target.value })
                }
              />
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <Repeat className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Recurring Booking
              </span>
            </label>

            {isRecurring && (
              <div className="space-y-3 pt-1">
                {/* Day checkboxes */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                    Repeat on
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-full text-xs font-semibold border transition ${
                          recurringDays.includes(i)
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Repeat until */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                    Repeat until
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    value={repeatUntil}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? isRecurring
                    ? "Save & Create Recurring"
                    : "Save Changes"
                  : isRecurring
                    ? "Create Recurring Bookings"
                    : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
