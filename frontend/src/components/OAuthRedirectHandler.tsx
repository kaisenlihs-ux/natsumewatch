"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Catches the `?auth_token=...` (or `?auth_error=...`) query parameter that
 * the backend appends after a successful OAuth login, stores the JWT, and
 * cleans up the URL so the parameter doesn't linger in the address bar or
 * leak through link sharing.
 */
export function OAuthRedirectHandler() {
  const { acceptToken } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("auth_token");
    const error = url.searchParams.get("auth_error");
    if (!token && !error) return;
    url.searchParams.delete("auth_token");
    url.searchParams.delete("auth_error");
    const cleaned = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
    window.history.replaceState({}, "", cleaned);
    if (token) {
      void acceptToken(token);
    } else if (error) {
      // Surface a single, non-blocking notice. We deliberately avoid a modal
      // here — the user can simply re-trigger the login button.
      // eslint-disable-next-line no-console
      console.warn("[oauth] login failed:", error);
    }
  }, [acceptToken]);

  return null;
}
