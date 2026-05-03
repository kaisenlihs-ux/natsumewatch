"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import clsx from "clsx";
import { apiFetch, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { UserOnlineDot } from "@/components/UserOnlineDot";
import type {
  Conversation,
  DirectMessage,
  Friend,
} from "@/lib/types";
import { formatRelative } from "@/lib/format";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-white/55">Загрузка...</div>}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, init } = useAuth();
  const peer = params.get("with") ?? "";

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const friends = useSWR<Friend[]>(user ? "/friends" : null, fetcher, {
    refreshInterval: 5000,
  });

  if (!user) return null;

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <aside
        className={clsx(
          "card p-2 md:block",
          peer ? "hidden md:block" : "block",
        )}
      >
        <div className="px-2 py-2 text-xs font-medium uppercase tracking-wider text-white/55">
          Диалоги
        </div>
        <div className="divide-y divide-bg-border/40">
          {(friends.data ?? []).length === 0 ? (
            <div className="p-4 text-sm text-white/55">
              Пока нет друзей.{" "}
              <Link href="/friends" className="text-brand-300 hover:underline">
                Найти
              </Link>
            </div>
          ) : (
            (friends.data ?? []).map((f) => (
              <Link
                key={f.user.id}
                href={`/messages?with=${f.user.username}`}
                className={clsx(
                  "flex items-center gap-3 rounded-lg p-2 transition hover:bg-bg-elevated/40",
                  peer === f.user.username && "bg-bg-elevated/60",
                )}
              >
                <Avatar
                  username={f.user.username}
                  url={f.user.avatar_url}
                  size={40}
                  shape="square"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {f.user.username}
                    </span>
                    <UserOnlineDot userId={f.user.id} />
                  </div>
                  <div className="truncate text-xs text-white/50">
                    {f.last_message ?? "Нет сообщений"}
                  </div>
                </div>
                {f.unread > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
                    {f.unread}
                  </span>
                )}
              </Link>
            ))
          )}
        </div>
      </aside>

      <section
        className={clsx(
          "card flex h-[calc(100vh-7rem)] flex-col overflow-hidden md:flex",
          peer ? "flex" : "hidden md:flex",
        )}
      >
        {peer ? (
          <Thread peer={peer} myId={user.id} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-white/55">
            Выберите диалог слева.
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ peer, myId }: { peer: string; myId: number }) {
  const key = `/messages/${encodeURIComponent(peer)}`;
  const { data, isLoading, error } = useSWR<Conversation>(key, fetcher, {
    refreshInterval: 4000,
  });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await apiFetch(key, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      setBody("");
      await Promise.all([mutate(key), mutate("/friends")]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-white/60">
        Не удалось открыть переписку. Возможно, вы ещё не друзья —{" "}
        <Link href="/friends" className="ml-1 text-brand-300 hover:underline">
          добавить в друзья
        </Link>
        .
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-bg-border/60 p-3">
        <Link
          href="/messages"
          className="rounded-md border border-bg-border px-2 py-1 text-xs text-white/70 md:hidden"
        >
          ← Назад
        </Link>
        {data?.user && (
          <>
            <Avatar
              username={data.user.username}
              url={data.user.avatar_url}
              size={36}
              shape="square"
            />
            <Link
              href={`/users?id=${data.user.id}`}
              className="truncate font-medium hover:text-brand-300"
            >
              {data.user.username}
            </Link>
            <UserOnlineDot userId={data.user.id} />
          </>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading && (
          <div className="text-sm text-white/55">Загрузка...</div>
        )}
        {(data?.messages ?? []).map((m) => (
          <Bubble key={m.id} m={m} mine={m.from_user_id === myId} />
        ))}
        {!isLoading && (data?.messages ?? []).length === 0 && (
          <div className="text-center text-sm text-white/45">
            Сообщений пока нет — напишите первое.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-bg-border/60 p-3"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Сообщение..."
          className="field flex-1"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="btn-primary"
        >
          Отправить
        </button>
      </form>
    </>
  );
}

function Bubble({ m, mine }: { m: DirectMessage; mine: boolean }) {
  return (
    <div className={clsx("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-brand-500 text-white"
            : "rounded-bl-md bg-bg-elevated text-white/90",
        )}
      >
        <div className="whitespace-pre-line break-words">{m.body}</div>
        <div
          className={clsx(
            "mt-0.5 text-right text-[10px]",
            mine ? "text-white/70" : "text-white/45",
          )}
        >
          {formatRelative(m.created_at)}
        </div>
      </div>
    </div>
  );
}
