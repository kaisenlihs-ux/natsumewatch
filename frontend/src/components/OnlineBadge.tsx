"use client";
import useSWR from "swr";
import clsx from "clsx";
import { fetcher } from "@/lib/api";

export function OnlineBadge({ className }: { className?: string }) {
  const { data } = useSWR<{ online: number }>("/stats/online", fetcher, {
    refreshInterval: 15_000,
  });
  const n = data?.online ?? 0;
  return (
    <div className={clsx("chip", className)} title="Сейчас на сайте">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inset-0 inline-flex rounded-full bg-emerald-400 animate-pulseDot" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="tabular-nums">{n.toLocaleString("ru-RU")}</span>
      <span className="text-white/60">онлайн</span>
    </div>
  );
}
