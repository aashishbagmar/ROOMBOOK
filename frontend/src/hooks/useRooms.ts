"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Room } from "@/lib/types";

export function useRooms() {
  return useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data } = await api.get<Room[]>("/api/rooms");
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
