import type { Poster } from "./types";

const BASE = "https://anilibria.top";

export function posterUrl(p: Poster | undefined | null, size: "src" | "preview" | "thumbnail" = "src"): string {
  if (!p) return "/placeholder-poster.svg";
  const opt = p.optimized?.[size];
  const fallback = p[size];
  const path = opt || fallback;
  if (!path) return "/placeholder-poster.svg";
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}${path}`;
}
