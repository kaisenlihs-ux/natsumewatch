"use client";

import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { fetcher } from "@/lib/api";
import type { Release } from "@/lib/types";
import { posterUrl } from "@/lib/posters";
import { Player } from "@/components/Player";
import { Comments } from "@/components/Comments";
import { Reviews } from "@/components/Reviews";
import { RatingWidget } from "@/components/RatingWidget";
import { formatDuration } from "@/lib/format";

export default function AnimeClient() {
  const sp = useSearchParams();
  const idOrAlias = sp.get("slug") || sp.get("id") || "";
  const { data, isLoading, error } = useSWR<Release>(
    idOrAlias ? `/anime/${idOrAlias}` : null,
    fetcher,
  );
  const [tab, setTab] = useState<"episodes" | "comments" | "reviews">("episodes");
  const [activeEp, setActiveEp] = useState<number>(1);

  if (!idOrAlias)
    return (
      <div className="card p-10 text-center text-white/70">Не указан тайтл.</div>
    );

  if (error)
    return (
      <div className="card p-10 text-center text-white/70">Не удалось загрузить тайтл.</div>
    );

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-[420px] w-full rounded-3xl" />
      </div>
    );
  }

  const r = data;
  const episodes = r.episodes ?? [];
  const ep = episodes.find((e) => e.ordinal === activeEp) ?? episodes[0];
  const sources = ep
    ? [
        { url: ep.hls_1080 || "", quality: "1080" },
        { url: ep.hls_720 || "", quality: "720" },
        { url: ep.hls_480 || "", quality: "480" },
      ].filter((s) => s.url)
    : [];

  return (
    <div className="space-y-8">
      {/* ----- Hero ----- */}
      <div className="relative overflow-hidden rounded-3xl border border-bg-border/60 bg-bg-panel">
        <div className="relative h-72 md:h-96">
          <Image
            src={posterUrl(r.poster, "src")}
            alt=""
            fill
            sizes="100vw"
            className="object-cover blur-xl scale-110 opacity-60"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-panel via-bg-panel/80 to-transparent" />
        </div>
        <div className="-mt-44 px-6 pb-6 md:-mt-56 md:px-10 md:pb-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end">
            <div className="relative h-64 w-44 shrink-0 overflow-hidden rounded-2xl border border-bg-border shadow-soft md:h-80 md:w-56">
              <Image
                src={posterUrl(r.poster, "src")}
                alt={r.name.main}
                fill
                sizes="(min-width:768px) 224px, 176px"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                {r.is_ongoing && (
                  <span className="rounded-full bg-brand-500/20 px-2.5 py-1 font-medium text-brand-300">
                    Онгоинг
                  </span>
                )}
                <span>{r.year}</span>
                <span>·</span>
                <span>{r.type?.description}</span>
                {r.season?.description && (
                  <>
                    <span>·</span>
                    <span>{r.season.description}</span>
                  </>
                )}
                {r.age_rating?.label && (
                  <>
                    <span>·</span>
                    <span>{r.age_rating.label}</span>
                  </>
                )}
                {r.episodes_total ? (
                  <>
                    <span>·</span>
                    <span>{r.episodes_total} серий</span>
                  </>
                ) : null}
              </div>
              <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
                {r.name.main}
              </h1>
              {r.name.english && (
                <div className="text-sm text-white/60">{r.name.english}</div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(r.genres ?? []).map((g) => (
                  <Link
                    key={g.id}
                    href={`/catalog?genres=${g.id}`}
                    className="chip hover:border-brand-400 hover:text-brand-200"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
              <RatingWidget releaseId={r.id} />
            </div>
          </div>
        </div>
      </div>

      {/* ----- Player + episodes ----- */}
      {ep ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <Player
              key={ep.id + "-" + activeEp}
              sources={sources}
              poster={ep.preview ? posterUrl(ep.preview, "src") : posterUrl(r.poster, "src")}
              title={`${r.name.main} · Серия ${ep.ordinal}${ep.name ? ` · ${ep.name}` : ""}`}
              autoPlay={false}
            />
            <div className="flex items-center justify-between text-sm">
              <div className="text-white/70">
                Серия {ep.ordinal}
                {ep.name ? ` · ${ep.name}` : ""}
                {ep.duration ? ` · ${formatDuration(ep.duration)}` : ""}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-ghost h-9"
                  disabled={activeEp <= 1}
                  onClick={() => setActiveEp((n) => Math.max(1, n - 1))}
                >
                  ← Пред
                </button>
                <button
                  className="btn-ghost h-9"
                  disabled={activeEp >= episodes.length}
                  onClick={() => setActiveEp((n) => Math.min(episodes.length, n + 1))}
                >
                  След →
                </button>
              </div>
            </div>
          </div>

          <div className="card max-h-[60vh] overflow-y-auto p-2">
            <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-white/50">
              Эпизоды ({episodes.length})
            </div>
            <ul className="space-y-1">
              {episodes.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setActiveEp(e.ordinal)}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition",
                      e.ordinal === activeEp
                        ? "border-brand-400 bg-brand-500/10"
                        : "border-transparent hover:border-bg-border hover:bg-bg-elevated",
                    )}
                  >
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-bg-elevated">
                      {e.preview?.src ? (
                        <Image
                          src={posterUrl(e.preview, "src")}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">Серия {e.ordinal}</div>
                      <div className="truncate text-xs text-white/55">
                        {e.name || "—"} · {formatDuration(e.duration)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-white/70">Эпизоды пока недоступны.</div>
      )}

      {/* ----- Description ----- */}
      {r.description && (
        <section className="card p-6">
          <h2 className="mb-3 text-lg font-semibold">Описание</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">
            {r.description}
          </p>
        </section>
      )}

      {/* ----- Tabs ----- */}
      <div>
        <div className="mb-4 flex gap-2">
          {(
            [
              ["episodes", "О тайтле"],
              ["reviews", "Рецензии"],
              ["comments", "Комментарии"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm transition",
                tab === k
                  ? "border-brand-400 bg-brand-500/15 text-brand-100"
                  : "border-bg-border bg-bg-panel/60 text-white/70 hover:border-white/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "episodes" && <Stats r={r} />}
        {tab === "comments" && <Comments releaseId={r.id} />}
        {tab === "reviews" && <Reviews releaseId={r.id} />}
      </div>
    </div>
  );
}

function Stats({ r }: { r: Release }) {
  const rows: [string, string | number | null | undefined][] = [
    ["Тип", r.type?.description],
    ["Год", r.year],
    ["Сезон", r.season?.description],
    ["Возраст", r.age_rating?.label],
    ["День выхода", r.publish_day?.description],
    ["Длительность серии", r.average_duration_of_episode ? `${r.average_duration_of_episode} мин` : null],
    ["Эпизодов", r.episodes_total],
    ["В избранном", r.added_in_users_favorites],
    ["Смотрят сейчас", r.added_in_watching_collection],
    ["Запланировали", r.added_in_planned_collection],
    ["Просмотрено", r.added_in_watched_collection],
  ];
  return (
    <div className="card p-6">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
        {rows.map(
          ([k, v]) =>
            v != null &&
            v !== "" && (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-bg-border/40 py-2 text-sm">
                <dt className="text-white/55">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ),
        )}
      </dl>
    </div>
  );
}
