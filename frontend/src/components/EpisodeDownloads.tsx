"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { DownloadsResponse } from "@/lib/types";

export function EpisodeDownloads({ idOrAlias }: { idOrAlias: string | number }) {
  const { data } = useSWR<DownloadsResponse>(`/anime/${idOrAlias}/downloads`, fetcher);
  const episodes = data?.episodes ?? [];
  if (!episodes.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-bg-border/60 px-5 py-3">
        <h3 className="font-display text-base font-semibold">Скачать серии</h3>
        <p className="mt-1 text-xs text-white/45">
          Прямая ссылка на HLS-плейлист серии (.m3u8), если плеер AniLibria доступен.
        </p>
      </div>
      <div className="max-h-[520px] overflow-y-auto divide-y divide-bg-border/40">
        {episodes.map((ep) => {
          const best = ep.download_hls_1080 || ep.download_hls_720 || ep.download_hls_480;
          return (
            <div key={ep.ordinal} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium">Серия {ep.ordinal}</div>
                <div className="truncate text-xs text-white/50">{ep.name || "Без названия"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ep.download_hls_480 && (
                  <a href={ep.download_hls_480} target="_blank" rel="noreferrer" className="btn-ghost h-9 px-3">
                    480p
                  </a>
                )}
                {ep.download_hls_720 && (
                  <a href={ep.download_hls_720} target="_blank" rel="noreferrer" className="btn-ghost h-9 px-3">
                    720p
                  </a>
                )}
                {ep.download_hls_1080 && (
                  <a href={ep.download_hls_1080} target="_blank" rel="noreferrer" className="btn-primary h-9 px-3">
                    1080p
                  </a>
                )}
                {!ep.download_hls_1080 && !ep.download_hls_720 && !ep.download_hls_480 && !best && (
                  <span className="text-xs text-white/35">недоступно</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
