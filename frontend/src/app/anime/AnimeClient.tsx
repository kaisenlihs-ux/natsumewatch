"use client";

import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { fetcher } from "@/lib/api";
import type {
  DubAnilibriaEpisode,
  DubKodikEpisode,
  DubSource,
  DubsResponse,
  Release,
} from "@/lib/types";
import { posterUrl } from "@/lib/posters";
import { Player } from "@/components/Player";
import { KodikPlayer } from "@/components/KodikPlayer";
import { DubSwitcher } from "@/components/DubSwitcher";
import { Comments } from "@/components/Comments";
import { Reviews } from "@/components/Reviews";
import { RatingWidget } from "@/components/RatingWidget";
import { formatDuration } from "@/lib/format";

function pickDefault(sources: DubSource[]): DubSource | null {
  if (!sources.length) return null;
  // Prefer AniLibria native (HLS, our own player) — most stable.
  return sources.find((s) => s.provider === "anilibria") ?? sources[0];
}

function clampOrdinal(source: DubSource | null, n: number): number {
  if (!source) return n;
  const max = source.episodes.length;
  if (max === 0) return 1;
  const ordinals = source.episodes.map((e) => e.ordinal);
  if (ordinals.includes(n)) return n;
  return ordinals[0];
}

export default function AnimeClient() {
  const sp = useSearchParams();
  const idOrAlias = sp.get("slug") || sp.get("id") || "";

  const releaseSWR = useSWR<Release>(
    idOrAlias ? `/anime/${idOrAlias}` : null,
    fetcher,
  );
  const dubsSWR = useSWR<DubsResponse>(
    idOrAlias ? `/anime/${idOrAlias}/dubs` : null,
    fetcher,
  );

  const [tab, setTab] = useState<"about" | "comments" | "reviews">("about");
  const [activeEp, setActiveEp] = useState<number>(1);
  const [activeSource, setActiveSource] = useState<DubSource | null>(null);

  const sources = useMemo(() => dubsSWR.data?.sources ?? [], [dubsSWR.data]);

  // Auto-pick a source as soon as the dubs response arrives.
  useEffect(() => {
    if (!activeSource && sources.length) {
      setActiveSource(pickDefault(sources));
    }
  }, [sources, activeSource]);

  // When user picks a different source, snap activeEp to the closest valid ordinal.
  useEffect(() => {
    if (!activeSource) return;
    setActiveEp((n) => clampOrdinal(activeSource, n));
  }, [activeSource]);

  const activeEpisode = useMemo(() => {
    if (!activeSource) return null;
    return (
      activeSource.episodes.find((e) => e.ordinal === activeEp) ??
      activeSource.episodes[0] ??
      null
    );
  }, [activeSource, activeEp]);

  if (!idOrAlias)
    return (
      <div className="card p-10 text-center text-white/70">Не указан тайтл.</div>
    );

  if (releaseSWR.error)
    return (
      <div className="card p-10 text-center text-white/70">
        Не удалось загрузить тайтл.
      </div>
    );

  if (releaseSWR.isLoading || !releaseSWR.data) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-[420px] w-full rounded-3xl" />
      </div>
    );
  }

  const r = releaseSWR.data;

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

      {/* ----- Dub picker ----- */}
      {dubsSWR.isLoading ? (
        <div className="skeleton h-24 w-full rounded-2xl" />
      ) : sources.length ? (
        <DubSwitcher
          sources={sources}
          active={activeSource}
          onPick={setActiveSource}
        />
      ) : (
        <div className="card p-4 text-sm text-white/65">
          Источники для просмотра пока не найдены.
        </div>
      )}

      {/* ----- Player + episodes ----- */}
      {activeSource && activeEpisode ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <PlayerForSource
              source={activeSource}
              episode={activeEpisode}
              titleMain={r.name.main}
              fallbackPoster={posterUrl(r.poster, "src")}
            />
            <div className="flex items-center justify-between text-sm">
              <div className="text-white/70">
                Серия {activeEpisode.ordinal}
                {"name" in activeEpisode && activeEpisode.name
                  ? ` · ${activeEpisode.name}`
                  : ""}
                {"duration" in activeEpisode && activeEpisode.duration
                  ? ` · ${formatDuration(activeEpisode.duration)}`
                  : ""}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-ghost h-9"
                  disabled={activeEp <= 1}
                  onClick={() =>
                    setActiveEp((n) =>
                      clampOrdinal(activeSource, Math.max(1, n - 1)),
                    )
                  }
                >
                  ← Пред
                </button>
                <button
                  className="btn-ghost h-9"
                  disabled={activeEp >= activeSource.episodes.length}
                  onClick={() =>
                    setActiveEp((n) =>
                      clampOrdinal(
                        activeSource,
                        Math.min(activeSource.episodes.length, n + 1),
                      ),
                    )
                  }
                >
                  След →
                </button>
              </div>
            </div>
          </div>

          <EpisodesList
            source={activeSource}
            activeEp={activeEp}
            onPick={(ord) => setActiveEp(ord)}
          />
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
              ["about", "О тайтле"],
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

        {tab === "about" && <Stats r={r} />}
        {tab === "comments" && <Comments releaseId={r.id} />}
        {tab === "reviews" && <Reviews releaseId={r.id} />}
      </div>
    </div>
  );
}

function PlayerForSource({
  source,
  episode,
  titleMain,
  fallbackPoster,
}: {
  source: DubSource;
  episode: DubAnilibriaEpisode | DubKodikEpisode;
  titleMain: string;
  fallbackPoster: string;
}) {
  const playerKey = `${source.provider}::${source.studio}::${episode.ordinal}`;
  const titleLabel = `${titleMain} · ${source.studio} · Серия ${episode.ordinal}`;

  if (source.provider === "anilibria") {
    const ep = episode as DubAnilibriaEpisode;
    const sources = [
      { url: ep.hls_1080 || "", quality: "1080" },
      { url: ep.hls_720 || "", quality: "720" },
      { url: ep.hls_480 || "", quality: "480" },
    ].filter((s) => s.url);
    return (
      <Player
        key={playerKey}
        sources={sources}
        poster={ep.preview ? posterUrl(ep.preview, "src") : fallbackPoster}
        title={titleLabel}
        autoPlay={false}
      />
    );
  }

  const ep = episode as DubKodikEpisode;
  return <KodikPlayer key={playerKey} src={ep.iframe} title={titleLabel} />;
}

function EpisodesList({
  source,
  activeEp,
  onPick,
}: {
  source: DubSource;
  activeEp: number;
  onPick: (ord: number) => void;
}) {
  return (
    <div className="card max-h-[60vh] overflow-y-auto p-2">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-white/50">
        Эпизоды ({source.episodes.length}) · {source.studio}
      </div>
      <ul className="space-y-1">
        {source.episodes.map((e) => {
          const isActive = e.ordinal === activeEp;
          const hasMeta = source.provider === "anilibria";
          const al = source.provider === "anilibria" ? (e as DubAnilibriaEpisode) : null;
          return (
            <li key={`${source.provider}-${e.ordinal}`}>
              <button
                onClick={() => onPick(e.ordinal)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition",
                  isActive
                    ? "border-brand-400 bg-brand-500/10"
                    : "border-transparent hover:border-bg-border hover:bg-bg-elevated",
                )}
              >
                {hasMeta && al?.preview?.src ? (
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-bg-elevated">
                    <Image
                      src={posterUrl(al.preview, "src")}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-xs text-white/45">
                    {e.ordinal}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Серия {e.ordinal}</div>
                  <div className="truncate text-xs text-white/55">
                    {al?.name || (source.provider === "kodik" ? "Kodik · iframe" : "—")}
                    {al?.duration ? ` · ${formatDuration(al.duration)}` : ""}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
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
    [
      "Длительность серии",
      r.average_duration_of_episode ? `${r.average_duration_of_episode} мин` : null,
    ],
    ["Эпизодов", r.episodes_total],
    ["В избранном", r.added_in_users_favorites],
    ["Смотрят сейчас", r.added_in_watching_collection],
    ["Запланировали", r.added_in_planned_collection],
    ["Просмотрено", r.added_in_watched_collection],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "") as [
    string,
    string | number,
  ][];

  return (
    <div className="card grid gap-x-6 gap-y-3 p-6 text-sm md:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 text-white/75">
          <span className="text-white/55">{k}</span>
          <span className="font-medium text-white">{v}</span>
        </div>
      ))}
    </div>
  );
}
