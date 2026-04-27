"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { ExternalRating, RatingsResponse } from "@/lib/types";

type Style = {
  label: string; // short brand label
  bg: string; // chip background tailwind classes
  border: string; // border classes
  text: string; // text color
  scoreBg: string; // bg for score pill
};

const STYLES: Record<string, Style> = {
  Shikimori: {
    label: "Шики",
    bg: "bg-rose-600/95",
    border: "border-rose-500/60",
    text: "text-white",
    scoreBg: "bg-bg-panel/90 text-white",
  },
  AniLibria: {
    label: "AL",
    bg: "bg-red-700/95",
    border: "border-red-500/60",
    text: "text-white",
    scoreBg: "bg-bg-panel/90 text-white",
  },
  IMDb: {
    label: "IMDb",
    bg: "bg-yellow-400",
    border: "border-yellow-500/70",
    text: "text-black",
    scoreBg: "bg-black/85 text-yellow-300",
  },
  "Кинопоиск": {
    label: "КП",
    bg: "bg-orange-500",
    border: "border-orange-400/70",
    text: "text-white",
    scoreBg: "bg-bg-panel/90 text-white",
  },
  MyAnimeList: {
    label: "MAL",
    bg: "bg-blue-600",
    border: "border-blue-500/60",
    text: "text-white",
    scoreBg: "bg-bg-panel/90 text-white",
  },
};

const FALLBACK_STYLE: Style = {
  label: "",
  bg: "bg-bg-elevated",
  border: "border-bg-border",
  text: "text-white/85",
  scoreBg: "bg-bg-panel text-white",
};

function formatVotes(v: number | null | undefined) {
  if (!v) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function Chip({ r }: { r: ExternalRating }) {
  const style = STYLES[r.source] ?? { ...FALLBACK_STYLE, label: r.source };
  const score =
    typeof r.value === "number" ? r.value.toFixed(2) : r.value ?? null;

  const inner = (
    <div
      className={`flex items-stretch overflow-hidden rounded-lg border ${style.border} shadow-soft`}
      title={
        formatVotes(r.votes) ? `${r.source} · ${formatVotes(r.votes)}` : r.source
      }
    >
      <div
        className={`flex items-center px-2.5 text-xs font-extrabold uppercase tracking-wide ${style.bg} ${style.text}`}
      >
        {style.label}
      </div>
      {score !== null && (
        <div
          className={`flex items-center px-2.5 text-sm font-semibold ${style.scoreBg}`}
        >
          {score}
        </div>
      )}
    </div>
  );

  if (r.url) {
    return (
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer"
        className="transition hover:scale-[1.03]"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

export function RatingsBar({ idOrAlias }: { idOrAlias: string | number }) {
  const { data } = useSWR<RatingsResponse>(
    `/anime/${idOrAlias}/ratings`,
    fetcher,
  );
  const ratings = data?.ratings ?? [];
  if (!ratings.length) return null;

  // Stable display order
  const order = ["Shikimori", "AniLibria", "IMDb", "Кинопоиск", "MyAnimeList"];
  const sorted = [...ratings].sort(
    (a, b) =>
      (order.indexOf(a.source) === -1 ? 99 : order.indexOf(a.source)) -
      (order.indexOf(b.source) === -1 ? 99 : order.indexOf(b.source)),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sorted.map((r) => (
        <Chip key={r.source} r={r} />
      ))}
    </div>
  );
}
