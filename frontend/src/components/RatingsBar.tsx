"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { RatingsResponse } from "@/lib/types";

function formatVotes(v: number | null | undefined) {
  if (!v) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export function RatingsBar({ idOrAlias }: { idOrAlias: string | number }) {
  const { data } = useSWR<RatingsResponse>(`/anime/${idOrAlias}/ratings`, fetcher);
  const ratings = data?.ratings ?? [];
  if (!ratings.length) return null;

  return (
    <div className="card p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/55">
        Внешние оценки
      </div>
      <div className="flex flex-wrap gap-2">
        {ratings.map((r) => {
          const body = (
            <>
              <span className="text-white/55">{r.source}</span>
              <span className="font-semibold text-white">
                {r.value ?? "—"}
              </span>
              {formatVotes(r.votes) && (
                <span className="text-white/35">· {formatVotes(r.votes)}</span>
              )}
            </>
          );
          if (r.url) {
            return (
              <a
                key={r.source}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="chip hover:border-white/40 hover:text-white"
              >
                {body}
              </a>
            );
          }
          return (
            <div key={r.source} className="chip">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
