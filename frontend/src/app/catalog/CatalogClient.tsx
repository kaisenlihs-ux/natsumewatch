"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetcher } from "@/lib/api";
import type { CatalogResponse, References } from "@/lib/types";
import { PosterCard, PosterCardSkeleton } from "@/components/PosterCard";
import clsx from "clsx";

type Filters = {
  page: number;
  search: string;
  genres: number[];
  types: string[];
  seasons: string[];
  age_ratings: string[];
  publish_statuses: string[];
  from_year: number | null;
  to_year: number | null;
  sorting: string | null;
};

const empty: Filters = {
  page: 1,
  search: "",
  genres: [],
  types: [],
  seasons: [],
  age_ratings: [],
  publish_statuses: [],
  from_year: null,
  to_year: null,
  sorting: null,
};

function buildQuery(f: Filters): string {
  const p = new URLSearchParams();
  p.set("page", String(f.page));
  p.set("limit", "24");
  if (f.search) p.set("search", f.search);
  for (const g of f.genres) p.append("genres", String(g));
  for (const t of f.types) p.append("types", t);
  for (const s of f.seasons) p.append("seasons", s);
  for (const a of f.age_ratings) p.append("age_ratings", a);
  for (const s of f.publish_statuses) p.append("publish_statuses", s);
  if (f.from_year) p.set("from_year", String(f.from_year));
  if (f.to_year) p.set("to_year", String(f.to_year));
  if (f.sorting) p.set("sorting", f.sorting);
  return p.toString();
}

export default function CatalogPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const initial: Filters = useMemo(() => {
    const get = (k: string) => sp.get(k);
    const getAll = (k: string) => sp.getAll(k);
    return {
      page: Number(get("page") || 1),
      search: get("search") || "",
      genres: getAll("genres").map(Number).filter(Boolean),
      types: getAll("types"),
      seasons: getAll("seasons"),
      age_ratings: getAll("age_ratings"),
      publish_statuses: sp.get("ongoing") === "1" ? ["IS_ONGOING"] : getAll("publish_statuses"),
      from_year: get("from_year") ? Number(get("from_year")) : null,
      to_year: get("to_year") ? Number(get("to_year")) : null,
      sorting: get("sorting") || "FRESH_AT_DESC",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [f, setF] = useState<Filters>(initial);
  // Filters are collapsed by default on narrow screens; the toggle below
  // flips this. Desktop CSS forces them open via md: classes regardless.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Reflect filters in URL
  useEffect(() => {
    const qs = buildQuery(f);
    router.replace(`/catalog?${qs}`, { scroll: false });
  }, [f, router]);

  const { data: refs } = useSWR<References>("/anime/references", fetcher);
  const { data, isLoading } = useSWR<CatalogResponse>(`/anime/catalog?${buildQuery(f)}`, fetcher);

  const items = data?.data ?? [];
  const total = data?.meta?.pagination?.total ?? 0;
  const totalPages = data?.meta?.pagination?.total_pages ?? 1;

  function toggleArr<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <aside className="card h-fit p-4 md:sticky md:top-20 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="mb-3 flex w-full items-center justify-between gap-2 rounded-lg border border-bg-border bg-bg-panel/60 px-3 py-2 text-sm font-medium text-white/80 hover:border-white/40 md:hidden"
          aria-expanded={filtersOpen}
        >
          <span>{filtersOpen ? "Скрыть фильтры" : "Показать фильтры"}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={clsx(
              "transition-transform",
              filtersOpen ? "rotate-180" : "",
            )}
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div
          className={clsx(
            "collapsible collapsible-mobile-only",
            filtersOpen && "is-open",
          )}
        >
          <div className="collapsible-inner">
        <FilterHeader title="Поиск">
          <input
            value={f.search}
            onChange={(e) => setF({ ...f, search: e.target.value, page: 1 })}
            placeholder="Название..."
            className="field"
          />
        </FilterHeader>

        <FilterHeader title="Сортировка">
          <select
            value={f.sorting ?? ""}
            onChange={(e) => setF({ ...f, sorting: e.target.value || null, page: 1 })}
            className="field"
          >
            {(refs?.sorting ?? []).map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FilterHeader>

        <FilterHeader title="Жанры">
          <div className="flex flex-wrap gap-1.5">
            {(refs?.genres ?? []).map((g) => {
              const active = f.genres.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => setF({ ...f, genres: toggleArr(f.genres, g.id), page: 1 })}
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-xs transition",
                    active
                      ? "border-brand-400 bg-brand-500/20 text-brand-200"
                      : "border-bg-border bg-bg-panel/60 text-white/70 hover:border-white/40",
                  )}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </FilterHeader>

        <FilterHeader title="Тип">
          <div className="flex flex-wrap gap-1.5">
            {(refs?.types ?? []).map((t) => {
              const active = f.types.includes(t.value);
              return (
                <button
                  key={t.value}
                  onClick={() => setF({ ...f, types: toggleArr(f.types, t.value), page: 1 })}
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-xs transition",
                    active
                      ? "border-brand-400 bg-brand-500/20 text-brand-200"
                      : "border-bg-border bg-bg-panel/60 text-white/70 hover:border-white/40",
                  )}
                >
                  {t.description}
                </button>
              );
            })}
          </div>
        </FilterHeader>

        <FilterHeader title="Сезон">
          <div className="flex flex-wrap gap-1.5">
            {(refs?.seasons ?? []).map((s) => {
              const active = f.seasons.includes(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => setF({ ...f, seasons: toggleArr(f.seasons, s.value), page: 1 })}
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-xs transition",
                    active
                      ? "border-brand-400 bg-brand-500/20 text-brand-200"
                      : "border-bg-border bg-bg-panel/60 text-white/70 hover:border-white/40",
                  )}
                >
                  {s.description}
                </button>
              );
            })}
          </div>
        </FilterHeader>

        <FilterHeader title="Год выпуска">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={f.from_year ?? ""}
              onChange={(e) =>
                setF({ ...f, from_year: e.target.value ? Number(e.target.value) : null, page: 1 })
              }
              className="field"
            >
              <option value="">от</option>
              {(refs?.years ?? []).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={f.to_year ?? ""}
              onChange={(e) =>
                setF({ ...f, to_year: e.target.value ? Number(e.target.value) : null, page: 1 })
              }
              className="field"
            >
              <option value="">до</option>
              {(refs?.years ?? []).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </FilterHeader>

        <FilterHeader title="Возраст">
          <div className="flex flex-wrap gap-1.5">
            {(refs?.age_ratings ?? []).map((a) => {
              const active = f.age_ratings.includes(a.value);
              return (
                <button
                  key={a.value}
                  onClick={() =>
                    setF({ ...f, age_ratings: toggleArr(f.age_ratings, a.value), page: 1 })
                  }
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-xs transition",
                    active
                      ? "border-brand-400 bg-brand-500/20 text-brand-200"
                      : "border-bg-border bg-bg-panel/60 text-white/70 hover:border-white/40",
                  )}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </FilterHeader>

        <FilterHeader title="Статус">
          <div className="flex flex-wrap gap-1.5">
            {(refs?.publish_statuses ?? []).map((p) => {
              const active = f.publish_statuses.includes(p.value);
              return (
                <button
                  key={p.value}
                  onClick={() =>
                    setF({
                      ...f,
                      publish_statuses: toggleArr(f.publish_statuses, p.value),
                      page: 1,
                    })
                  }
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-xs transition",
                    active
                      ? "border-brand-400 bg-brand-500/20 text-brand-200"
                      : "border-bg-border bg-bg-panel/60 text-white/70 hover:border-white/40",
                  )}
                >
                  {p.description}
                </button>
              );
            })}
          </div>
        </FilterHeader>

        <button
          onClick={() => setF({ ...empty, sorting: "FRESH_AT_DESC" })}
          className="btn-ghost mt-2 w-full"
        >
          Сбросить
        </button>
          </div>
        </div>
      </aside>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold md:text-3xl">Каталог</h1>
          <div className="text-sm text-white/60">{total.toLocaleString("ru-RU")} тайтлов</div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <PosterCardSkeleton key={i} />)
            : items.map((r) => <PosterCard key={r.id} r={r} />)}
        </div>
        {!isLoading && items.length === 0 && (
          <div className="card mt-8 p-8 text-center text-white/60">
            По выбранным фильтрам ничего не найдено.
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            page={f.page}
            total={totalPages}
            onChange={(p) => setF({ ...f, page: p })}
          />
        )}
      </section>
    </div>
  );
}

function FilterHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-bg-border/60 py-3 last:border-b-0">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/50">
        {title}
      </div>
      {children}
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = paginationRange(page, total, 1);
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="btn-ghost h-9 px-3 text-sm"
      >
        ←
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`g${i}`} className="px-2 text-white/40">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={clsx(
              "h-9 min-w-9 rounded-full border px-3 text-sm transition",
              p === page
                ? "border-brand-400 bg-brand-500/20 text-brand-200"
                : "border-bg-border bg-bg-panel/60 text-white/70 hover:border-white/40",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
        className="btn-ghost h-9 px-3 text-sm"
      >
        →
      </button>
    </div>
  );
}

function paginationRange(current: number, total: number, sib = 1): (number | "…")[] {
  const pages: (number | "…")[] = [];
  const left = Math.max(2, current - sib);
  const right = Math.min(total - 1, current + sib);
  pages.push(1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("…");
  if (total > 1) pages.push(total);
  return pages;
}
