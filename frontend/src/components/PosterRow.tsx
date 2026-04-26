"use client";
import useSWR from "swr";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { PosterCard, PosterCardSkeleton } from "./PosterCard";
import type { ReleaseSummary } from "@/lib/types";

export function PosterRow({
  title,
  endpoint,
  href,
}: {
  title: string;
  endpoint: string;
  href?: string;
}) {
  const { data, isLoading } = useSWR<ReleaseSummary[] | { data: ReleaseSummary[] }>(
    endpoint,
    fetcher,
  );
  const items = Array.isArray(data) ? data : data?.data ?? [];
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-xl md:text-2xl font-semibold">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-sm text-white/60 transition hover:text-brand-400"
          >
            Смотреть все →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <PosterCardSkeleton key={i} />)
          : items.slice(0, 12).map((r) => <PosterCard key={r.id} r={r} />)}
      </div>
    </section>
  );
}
