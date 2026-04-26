"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TorrentsResponse } from "@/lib/types";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} МБ`;
  return `${(bytes / 1024).toFixed(0)} КБ`;
}

export function TorrentsList({ idOrAlias }: { idOrAlias: string | number }) {
  const { data, isLoading } = useSWR<TorrentsResponse>(
    `/anime/${idOrAlias}/torrents`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="card p-6 text-sm text-white/60">Загрузка торрентов…</div>
    );
  }
  const torrents = data?.torrents ?? [];
  if (!torrents.length) {
    return (
      <div className="card p-6 text-sm text-white/60">
        Для этого тайтла торренты пока не выложены на AniLibria.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-bg-border/60 px-5 py-3">
        <h3 className="font-display text-base font-semibold">
          Скачать торренты
        </h3>
        <span className="text-xs text-white/40">через AniLibria</span>
      </div>
      <div className="divide-y divide-bg-border/40">
        {torrents.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-300">
                  {t.quality ?? "?"}
                </span>
                {t.type && <span className="chip">{t.type}</span>}
                {t.codec && (
                  <span className="text-xs text-white/50">{t.codec}</span>
                )}
                {t.is_hardsub && (
                  <span className="chip border-amber-400/40 text-amber-300">
                    хардсаб
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-sm text-white/80">
                {t.label || t.filename || `Torrent #${t.id}`}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-white/50">
                {t.episodes && <span>серии {t.episodes}</span>}
                <span>{formatBytes(t.size)}</span>
                <span className="text-emerald-400">{t.seeders ?? 0} ↑</span>
                <span className="text-rose-300/80">{t.leechers ?? 0} ↓</span>
                {typeof t.completed_times === "number" && (
                  <span>скачано {t.completed_times}×</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {t.download_url && (
                <a
                  href={t.download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  .torrent
                </a>
              )}
              {t.magnet && (
                <a href={t.magnet} className="btn-primary">
                  Magnet
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
