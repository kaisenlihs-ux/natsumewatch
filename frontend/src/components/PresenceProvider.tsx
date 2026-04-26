"use client";
import { useEffect } from "react";
import { startPresenceHeartbeat } from "@/lib/presence";

export function PresenceProvider() {
  useEffect(() => {
    startPresenceHeartbeat();
  }, []);
  return null;
}
