"use client";

import useSWR from "swr";
import { API_BASE, fetcher } from "@/lib/api";

type Providers = {
  discord?: boolean;
  google?: boolean;
};

export function OAuthButtons() {
  // Quietly skip rendering when no provider is enabled server-side. We use the
  // existing fetcher so the call goes through the same `/api` base as other
  // requests.
  const { data } = useSWR<Providers>("/auth/providers", fetcher);

  const enabled = data ?? {};
  const any = Boolean(enabled.discord || enabled.google);
  if (!any) return null;

  const startUrl = (provider: string) => {
    const returnTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : "/";
    const params = new URLSearchParams({ return_to: returnTo });
    return `${API_BASE}/api/auth/${provider}/start?${params}`;
  };

  return (
    <div className="space-y-2">
      <div className="my-4 flex items-center gap-3 text-xs text-white/45">
        <span className="h-px flex-1 bg-bg-border/60" />
        <span>или войти через</span>
        <span className="h-px flex-1 bg-bg-border/60" />
      </div>
      <div className="flex flex-col gap-2">
        {enabled.discord && (
          <a
            href={startUrl("discord")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.073.035c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.502 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.073-.035 19.74 19.74 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.1.246.198.372.293a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.673-3.548-13.66a.061.061 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Войти через Discord
          </a>
        )}
        {enabled.google && (
          <a
            href={startUrl("google")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-bg-base transition hover:brightness-105"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4-5.4 4-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.8 0 3.1.8 3.8 1.4l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-2H12z"
              />
            </svg>
            Войти через Google
          </a>
        )}
      </div>
    </div>
  );
}
