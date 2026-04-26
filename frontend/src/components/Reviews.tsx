"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useState } from "react";
import { apiFetch, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Review } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import clsx from "clsx";

export function Reviews({ releaseId }: { releaseId: number }) {
  const { user } = useAuth();
  const key = `/anime/${releaseId}/reviews`;
  const { data, isLoading } = useSWR<Review[]>(key, fetcher);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [score, setScore] = useState(8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (title.trim().length < 2 || body.trim().length < 10) {
      setErr("Заголовок ≥ 2 символов, текст ≥ 10 символов.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(key, {
        method: "POST",
        body: JSON.stringify({ title, body, score }),
      });
      setTitle("");
      setBody("");
      setOpen(false);
      mutate(key);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Рецензии</h2>
        {user ? (
          <button onClick={() => setOpen((v) => !v)} className="btn-ghost">
            {open ? "Отмена" : "Написать рецензию"}
          </button>
        ) : (
          <Link href="/login" className="text-sm text-brand-400 hover:underline">
            Войдите, чтобы написать
          </Link>
        )}
      </div>

      {open && user && (
        <div className="mb-6 space-y-3 rounded-xl border border-bg-border bg-bg-elevated/40 p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок рецензии"
            className="field"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Напиши развёрнутое мнение..."
            className="field resize-y"
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/60">Оценка:</span>
            {[6, 7, 8, 9, 10].map((s) => (
              <button
                key={s}
                onClick={() => setScore(s)}
                className={clsx(
                  "h-9 w-9 rounded-full border text-sm transition",
                  score === s
                    ? "border-brand-400 bg-brand-500/20 text-brand-200"
                    : "border-bg-border text-white/70 hover:border-white/40",
                )}
              >
                {s}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={10}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="field w-24"
            />
          </div>
          {err && <div className="text-xs text-brand-400">{err}</div>}
          <div className="flex justify-end">
            <button onClick={submit} disabled={busy} className="btn-primary">
              {busy ? "Сохраняем..." : "Опубликовать"}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-sm text-white/50">Загрузка...</div>}
      <ul className="space-y-4">
        {(data ?? []).map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-bg-border/60 bg-bg-elevated/40 p-5"
          >
            <div className="mb-2 flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 text-xs font-bold uppercase">
                {r.user.username.slice(0, 1)}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">{r.user.username}</div>
                <div className="text-xs text-white/40">{formatRelative(r.created_at)}</div>
              </div>
              <div className="flex items-center gap-1 text-yellow-400">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                <span className="text-sm font-semibold tabular-nums">{r.score}/10</span>
              </div>
            </div>
            <h3 className="mb-2 text-base font-semibold">{r.title}</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">{r.body}</p>
          </li>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <li className="text-sm text-white/50">Пока нет рецензий.</li>
        )}
      </ul>
    </section>
  );
}
