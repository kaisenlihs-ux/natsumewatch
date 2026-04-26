"use client";

import { apiFetch } from "./api";

let timer: ReturnType<typeof setInterval> | null = null;

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("nw_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nw_session", id);
  }
  return id;
}

export function startPresenceHeartbeat() {
  if (timer) return;
  const beat = async () => {
    try {
      await apiFetch("/stats/heartbeat", {
        method: "POST",
        body: JSON.stringify({ session_id: getSessionId() }),
        skipAuth: true,
      });
    } catch {
      /* ignore */
    }
  };
  beat();
  timer = setInterval(beat, 45_000);
}
