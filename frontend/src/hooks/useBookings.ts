"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BookingListResponse } from "@/lib/types";

interface BookingFilters {
  room_id?: number;
  start_date?: string;
  end_date?: string;
  search?: string;
  my_bookings?: boolean;
  page?: number;
  page_size?: number;
}

export function useBookings(filters: BookingFilters) {
  return useQuery<BookingListResponse>({
    queryKey: ["bookings", filters],
    queryFn: async () => {
      const { data } = await api.get<BookingListResponse>("/api/bookings", {
        params: filters,
      });
      return data;
    },
    staleTime: 60 * 1000, // 60 seconds
  });
}
