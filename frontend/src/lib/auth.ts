"use client";
import { create } from "zustand";
import { apiFetch } from "./api";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email_or_username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  acceptToken: (access_token: string) => Promise<void>;
  logout: () => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  async init() {
    if (get().user) return;
    if (typeof window === "undefined") {
      set({ loading: false });
      return;
    }
    const t = localStorage.getItem("nw_token");
    if (!t) {
      set({ loading: false });
      return;
    }
    try {
      const me = await apiFetch<User>("/auth/me");
      set({ user: me, loading: false });
    } catch {
      localStorage.removeItem("nw_token");
      set({ user: null, loading: false });
    }
  },
  async login(email_or_username, password) {
    const data = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email_or_username, password }),
      skipAuth: true,
    });
    localStorage.setItem("nw_token", data.access_token);
    set({ user: data.user });
  },
  async register(username, email, password) {
    const data = await apiFetch<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
      skipAuth: true,
    });
    localStorage.setItem("nw_token", data.access_token);
    set({ user: data.user });
  },
  async acceptToken(access_token) {
    if (typeof window === "undefined") return;
    localStorage.setItem("nw_token", access_token);
    try {
      const me = await apiFetch<User>("/auth/me");
      set({ user: me, loading: false });
    } catch {
      localStorage.removeItem("nw_token");
      set({ user: null, loading: false });
    }
  },
  logout() {
    if (typeof window !== "undefined") localStorage.removeItem("nw_token");
    set({ user: null });
  },
}));
