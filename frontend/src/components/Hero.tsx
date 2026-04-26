"use client";
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import type { ReleaseSummary } from "@/lib/types";
import { posterUrl } from "@/lib/posters";

export function Hero() {
  const { data } = useSWR<ReleaseSummary[]>("/anime/featured", fetcher);
  const [idx, setIdx] = useState(0);
  const list = data ?? [];

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), 6500);
    return () => clearInterval(t);
  }, [list.length]);

  if (list.length === 0) {
    return (
      <div className="skeleton h-[420px] w-full rounded-3xl md:h-[520px]" />
    );
  }

  const r = list[idx];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-bg-border/60 bg-bg-panel">
      <div className="relative h-[420px] w-full md:h-[520px]">
        <Image
          key={r.id}
          src={posterUrl(r.poster, "src")}
          alt={r.name.main}
          fill
          priority
          sizes="100vw"
          className="object-cover blur-[1px] scale-105"
          unoptimized
        />
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />

        <div className="container-page relative flex h-full flex-col justify-end gap-5 pb-10 md:pb-16">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span className="rounded-full bg-brand-500/20 px-2.5 py-1 font-medium text-brand-300">
              {r.is_ongoing ? "Онгоинг" : "Завершено"}
            </span>
            <span>{r.year}</span>
            <span>·</span>
            <span>{r.type?.description}</span>
            {r.age_rating?.label && (
              <>
                <span>·</span>
                <span>{r.age_rating.label}</span>
              </>
            )}
          </div>
          <h1 className="max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">
            {r.name.main}
          </h1>
          {r.name.english && (
            <div className="max-w-3xl text-sm text-white/60">{r.name.english}</div>
          )}
          {r.description && (
            <p className="max-w-2xl text-sm text-white/75 line-clamp-3 md:text-base">
              {r.description}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href={`/anime/${r.alias || r.id}`} className="btn-primary">
              <PlayIcon /> Смотреть
            </Link>
            <Link href={`/anime/${r.alias || r.id}`} className="btn-ghost">
              Подробнее
            </Link>
          </div>
        </div>

        {list.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Слайд ${i + 1}`}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === idx ? "w-8 bg-brand-500" : "w-3 bg-white/30 hover:bg-white/60")
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}
