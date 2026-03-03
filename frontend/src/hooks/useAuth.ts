"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { User, Token } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("roombook_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<User>("/api/users/me");
      setUser(data);
    } catch {
      localStorage.removeItem("roombook_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (payload: { email: string; password: string }) => {
    const { data } = await api.post<Token>("/api/auth/login", payload);
    localStorage.setItem("roombook_token", data.access_token);
    await fetchUser();
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    department?: string;
  }) => {
    await api.post("/api/auth/register", payload);
  };

  const logout = () => {
    localStorage.removeItem("roombook_token");
    setUser(null);
    window.location.href = "/login";
  };

  return { user, loading, login, register, logout };
}
