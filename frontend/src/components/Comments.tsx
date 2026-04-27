"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { apiFetch, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Comment as CommentT } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { Avatar } from "./Avatar";

export function Comments({ releaseId }: { releaseId: number }) {
  const { user } = useAuth();
  const key = `/anime/${releaseId}/comments`;
  const { data, isLoading } = useSWR<CommentT[]>(key, fetcher);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(key, {
        method: "POST",
        body: JSON.stringify({ body, parent_id: replyTo }),
      });
      setBody("");
      setReplyTo(null);
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

  async function toggleLike(c: CommentT) {
    if (!user) return;
    await apiFetch(`${key}/${c.id}/like`, { method: "POST" });
    mutate(key);
  }

  async function vote(c: CommentT, dir: 1 | -1) {
    if (!user) return;
    // toggle off when re-clicking the same direction
    const value = c.vote_by_me === dir ? 0 : dir;
    await apiFetch(`${key}/${c.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
    mutate(key);
  }

  // Group comments into a tree (one level of nesting).
  const list = data ?? [];
  const roots = list.filter((c) => !c.parent_id);
  const childrenOf = (id: number) =>
    list
      .filter((c) => c.parent_id === id)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

  const replyTarget = replyTo ? list.find((c) => c.id === replyTo) : null;

  function CommentBox({ c, isReply = false }: { c: CommentT; isReply?: boolean }) {
    const own = user?.id === c.user.id;
    return (
      <div
        className={clsx(
          "flex gap-3 rounded-xl border border-bg-border/60 bg-bg-elevated/40 p-4",
          isReply && "ml-6 border-l-4 border-l-brand-500/50",
        )}
      >
        <Link href={`/u/${c.user.username}`} className="shrink-0">
          <Avatar
            username={c.user.username}
            url={c.user.avatar_url}
            size={44}
            shape="square"
            className="ring-1 ring-bg-border"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-sm">
            <Link
              href={`/u/${c.user.username}`}
              className="font-medium hover:text-brand-300"
            >
              {c.user.username}
            </Link>
            <span className="text-xs text-white/40">
              {formatRelative(c.created_at)}
            </span>
            {own && (
              <button
                onClick={() => remove(c.id)}
                className="ml-auto text-xs text-white/40 hover:text-brand-400"
              >
                Удалить
              </button>
            )}
          </div>
          <p className="whitespace-pre-line text-sm text-white/85">{c.body}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-white/60">
            {/* Up vote */}
            <button
              onClick={() => vote(c, 1)}
              disabled={!user}
              className={clsx(
                "flex items-center gap-1 rounded-md border border-bg-border px-2 py-1 transition",
                c.vote_by_me === 1
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                  : "hover:border-emerald-500/40 hover:text-emerald-300",
                !user && "cursor-not-allowed opacity-60",
              )}
              title="Полезный комментарий"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 9l4-5 4 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span
              className={clsx(
                "min-w-[1.5rem] text-center font-semibold",
                c.score > 0 && "text-emerald-300",
                c.score < 0 && "text-rose-300",
              )}
            >
              {c.score}
            </span>
            {/* Down vote */}
            <button
              onClick={() => vote(c, -1)}
              disabled={!user}
              className={clsx(
                "flex items-center gap-1 rounded-md border border-bg-border px-2 py-1 transition",
                c.vote_by_me === -1
                  ? "border-rose-500/60 bg-rose-500/15 text-rose-300"
                  : "hover:border-rose-500/40 hover:text-rose-300",
                !user && "cursor-not-allowed opacity-60",
              )}
              title="Не согласен"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 5l4 5 4-5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* Like */}
            <button
              onClick={() => toggleLike(c)}
              disabled={!user}
              className={clsx(
                "ml-2 flex items-center gap-1 rounded-md border border-bg-border px-2 py-1 transition",
                c.liked_by_me
                  ? "border-pink-500/60 bg-pink-500/15 text-pink-300"
                  : "hover:border-pink-500/40 hover:text-pink-300",
                !user && "cursor-not-allowed opacity-60",
              )}
              title="Нравится"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill={c.liked_by_me ? "currentColor" : "none"}
              >
                <path
                  d="M8 13.5s-5-3.2-5-6.6A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5 1.9c0 3.4-5 6.6-5 6.6z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{c.like_count}</span>
            </button>
            {!isReply && user && (
              <button
                onClick={() => setReplyTo(c.id)}
                className="ml-2 rounded-md border border-bg-border px-2 py-1 hover:border-brand-400 hover:text-brand-300"
              >
                Ответить
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-semibold">Комментарии</h2>
      {user ? (
        <div className="mb-6 space-y-2">
          {replyTarget && (
            <div className="flex items-center gap-2 rounded-lg border border-bg-border bg-bg-elevated/60 px-3 py-2 text-xs text-white/70">
              <span>
                Ответ для <b>{replyTarget.user.username}</b>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="ml-auto text-white/50 hover:text-white"
              >
                Отменить
              </button>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              replyTarget ? "Напишите ответ..." : "Поделитесь впечатлениями..."
            }
            rows={3}
            className="field resize-y"
          />
          {err && <div className="text-xs text-brand-400">{err}</div>}
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={busy || !body.trim()}
              className="btn-primary"
            >
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
        {roots.map((c) => {
          const replies = childrenOf(c.id);
          return (
            <li key={c.id} className="space-y-2">
              <CommentBox c={c} />
              {replies.length > 0 && (
                <div className="space-y-2">
                  {replies.map((r) => (
                    <CommentBox key={r.id} c={r} isReply />
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {!isLoading && roots.length === 0 && (
          <li className="text-sm text-white/50">
            Пока нет комментариев — будь первым!
          </li>
        )}
      </ul>
    </section>
  );
}
