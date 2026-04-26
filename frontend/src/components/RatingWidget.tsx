"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import clsx from "clsx";
import { apiFetch, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { RatingSummary } from "@/lib/types";
import Link from "next/link";

export function RatingWidget({ releaseId }: { releaseId: number }) {
  const { user } = useAuth();
  const key = `/anime/${releaseId}/rating`;
  const { data } = useSWR<RatingSummary>(key, fetcher);
  const [hover, setHover] = useState<number | null>(null);
  const my = data?.user_score ?? null;
  const display = hover ?? my ?? 0;

  async function setScore(v: number) {
    if (!user) return;
    await apiFetch<RatingSummary>(key, {
      method: "POST",
      body: JSON.stringify({ score: v }),
    });
    mutate(key);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 rounded-2xl border border-bg-border bg-bg-panel/60 px-3 py-2">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="currentColor">
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
        <span className="text-lg font-semibold tabular-nums">
          {(data?.average ?? 0).toFixed(1)}
        </span>
        <span className="text-xs text-white/50">/ {data?.count ?? 0} оценок</span>
      </div>
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
        title={user ? "Оцените тайтл" : "Войдите, чтобы оценить"}
      >
        {Array.from({ length: 10 }).map((_, i) => {
          const v = i + 1;
          return (
            <button
              key={v}
              disabled={!user}
              onMouseEnter={() => setHover(v)}
              onClick={() => setScore(v)}
              className={clsx(
                "h-7 w-7 transition",
                user ? "cursor-pointer" : "cursor-default opacity-60",
              )}
              aria-label={`Оценка ${v}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill={display >= v ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
                className={clsx(
                  "mx-auto h-6 w-6",
                  display >= v ? "text-yellow-400" : "text-white/30",
                )}
              >
                <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </button>
          );
        })}
      </div>
      {!user && (
        <Link href="/login" className="text-xs text-white/55 hover:text-brand-400">
          Войдите, чтобы оценить
        </Link>
      )}
    </div>
  );
}
