"use client";

import Link from "next/link";
import useSWR from "swr";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { apiFetch, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  LIST_STATUSES,
  STATUS_LABELS,
  type ListItem,
  type ListStatus,
  type ListStatusCount,
} from "@/lib/types";
import { posterUrl } from "@/lib/posters";

function ListsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const status = (sp.get("status") as ListStatus) || "watching";
  const { user, loading, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const counts = useSWR<ListStatusCount[]>(
    user ? "/me/lists/counts" : null,
    fetcher,
  );
  const items = useSWR<ListItem[]>(
    user ? `/me/lists?status_value=${status}` : null,
    fetcher,
  );

  if (!user) return <div className="card p-10 text-white/60">Загрузка…</div>;

  const map: Record<string, number> = {};
  for (const c of counts.data ?? []) map[c.status] = c.count;

  async function remove(it: ListItem) {
    if (!confirm("Убрать из списка?")) return;
    await apiFetch(
      `/me/lists?release_id=${it.release_id}&status_value=${it.status}`,
      { method: "DELETE" },
    );
    items.mutate();
    counts.mutate();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Мои списки</h1>
        <Link href="/profile" className="text-sm text-white/60 hover:text-white">
          ← Профиль
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {LIST_STATUSES.map((s) => {
          const count = map[s] ?? 0;
          return (
            <Link
              key={s}
              href={`/profile/lists?status=${s}`}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition",
                s === status
                  ? "border-brand-400 bg-brand-500/15 text-brand-100"
                  : "border-bg-border bg-bg-panel/60 text-white/80 hover:border-white/40",
              )}
            >
              {STATUS_LABELS[s]}
              <span
                className={clsx(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  s === status ? "bg-brand-500/30" : "bg-white/10",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {items.isLoading ? (
        <div className="card p-8 text-center text-white/55">Загрузка…</div>
      ) : (items.data ?? []).length === 0 ? (
        <div className="card p-8 text-center text-white/55">
          В списке «{STATUS_LABELS[status]}» пока ничего нет.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {(items.data ?? []).map((it) => (
            <div key={it.id} className="group relative">
              <Link
                href={`/anime?slug=${it.release_alias ?? it.release_id}`}
                className="block"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-bg-elevated">
                  {it.release_poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl(
                        { src: it.release_poster, preview: null, thumbnail: null },
                        "src",
                      )}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="mt-2 truncate text-sm font-medium">
                  {it.release_title ?? `#${it.release_id}`}
                </div>
                <div className="truncate text-xs text-white/45">
                  {[it.release_type, it.release_year].filter(Boolean).join(" · ")}
                </div>
              </Link>
              <button
                onClick={() => remove(it)}
                className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-bg-base/80 text-sm text-white/70 hover:bg-brand-500/40 hover:text-white group-hover:flex"
                title="Убрать"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListsPage() {
  return (
    <Suspense fallback={<div className="card p-10 text-white/60">Загрузка…</div>}>
      <ListsInner />
    </Suspense>
  );
}
