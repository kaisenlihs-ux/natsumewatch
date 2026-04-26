"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import type { ReleaseSummary } from "@/lib/types";
import { posterUrl } from "@/lib/posters";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ReleaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch<ReleaseSummary[]>(
          `/anime/search?q=${encodeURIComponent(q)}&limit=8`,
        );
        if (!cancel) setResults(data);
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 220);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div ref={wrap} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder="Поиск аниме..."
          className="field !pl-9"
        />
      </div>
      {open && (q.trim().length > 0 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-bg-border bg-bg-panel/95 shadow-soft backdrop-blur-xl">
          {loading && (
            <div className="px-4 py-3 text-sm text-white/60">Ищем...</div>
          )}
          {!loading && results.length === 0 && q.trim() && (
            <div className="px-4 py-3 text-sm text-white/60">Ничего не найдено</div>
          )}
          <ul className="py-1">
            {results.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/anime/${r.alias || r.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated"
                >
                  <Image
                    src={posterUrl(r.poster, "thumbnail")}
                    alt=""
                    width={40}
                    height={56}
                    className="h-14 w-10 rounded object-cover"
                    unoptimized
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.name.main}</div>
                    <div className="truncate text-xs text-white/50">
                      {r.year} · {r.type?.description}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
