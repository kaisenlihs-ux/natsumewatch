"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useState } from "react";
import { apiFetch, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Comment as CommentT } from "@/lib/types";
import { formatRelative } from "@/lib/format";

export function Comments({ releaseId }: { releaseId: number }) {
  const { user } = useAuth();
  const key = `/anime/${releaseId}/comments`;
  const { data, isLoading } = useSWR<CommentT[]>(key, fetcher);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(key, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      mutate(key);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Удалить комментарий?")) return;
    await apiFetch(`${key}/${id}`, { method: "DELETE" });
    mutate(key);
  }

  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-semibold">Комментарии</h2>
      {user ? (
        <div className="mb-6 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Поделитесь впечатлениями..."
            rows={3}
            className="field resize-y"
          />
          {err && <div className="text-xs text-brand-400">{err}</div>}
          <div className="flex justify-end">
            <button onClick={submit} disabled={busy || !body.trim()} className="btn-primary">
              {busy ? "Отправляем..." : "Опубликовать"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-bg-border bg-bg-elevated/50 p-3 text-sm text-white/70">
          <Link href="/login" className="text-brand-400 hover:underline">
            Войдите
          </Link>
          , чтобы оставить комментарий.
        </div>
      )}

      {isLoading && <div className="text-sm text-white/50">Загрузка...</div>}
      <ul className="space-y-3">
        {(data ?? []).map((c) => (
          <li
            key={c.id}
            className="rounded-xl border border-bg-border/60 bg-bg-elevated/40 p-4"
          >
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 text-xs font-bold uppercase">
                {c.user.username.slice(0, 1)}
              </span>
              <span className="font-medium">{c.user.username}</span>
              <span className="text-xs text-white/40">{formatRelative(c.created_at)}</span>
              {user?.id === c.user.id && (
                <button
                  onClick={() => remove(c.id)}
                  className="ml-auto text-xs text-white/40 hover:text-brand-400"
                >
                  Удалить
                </button>
              )}
            </div>
            <p className="whitespace-pre-line text-sm text-white/85">{c.body}</p>
          </li>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <li className="text-sm text-white/50">Пока нет комментариев — будь первым!</li>
        )}
      </ul>
    </section>
  );
}
