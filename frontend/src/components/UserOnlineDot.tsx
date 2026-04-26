"use client";

import useSWR from "swr";
import clsx from "clsx";
import { fetcher } from "@/lib/api";
import { formatRelative } from "@/lib/format";

type Online = { online: boolean; last_seen_at: string | null };

export function UserOnlineDot({
  userId,
  showLabel = false,
  className,
}: {
  userId: number;
  showLabel?: boolean;
  className?: string;
}) {
  const { data } = useSWR<Online>(`/users/${userId}/online`, fetcher, {
    refreshInterval: 30_000,
  });
  const online = !!data?.online;
  const label = online
    ? "В сети"
    : data?.last_seen_at
      ? `Был(а) ${formatRelative(data.last_seen_at)}`
      : "Не в сети";
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs", className)} title={label}>
      <span className="relative inline-flex h-2.5 w-2.5">
        {online && (
          <span className="absolute inset-0 inline-flex rounded-full bg-emerald-400 animate-pulseDot" />
        )}
        <span
          className={clsx(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            online ? "bg-emerald-400" : "bg-white/25",
          )}
        />
      </span>
      {showLabel && <span className="text-white/60">{label}</span>}
    </span>
  );
}
