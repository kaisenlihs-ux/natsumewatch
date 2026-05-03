"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import clsx from "clsx";
import { apiFetch, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { UserOnlineDot } from "@/components/UserOnlineDot";
import type {
  Friend,
  FriendRequest,
  PublicUser,
} from "@/lib/types";
import { formatRelative } from "@/lib/format";

type Tab = "friends" | "incoming" | "outgoing" | "search";

export default function FriendsPage() {
  const router = useRouter();
  const { user, loading, init } = useAuth();
  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const friends = useSWR<Friend[]>(user ? "/friends" : null, fetcher);
  const incoming = useSWR<FriendRequest[]>(
    user ? "/friends/incoming" : null,
    fetcher,
  );
  const outgoing = useSWR<FriendRequest[]>(
    user ? "/friends/outgoing" : null,
    fetcher,
  );
  const search = useSWR<PublicUser[]>(
    tab === "search" && query.trim().length >= 2
      ? `/friends/search?q=${encodeURIComponent(query.trim())}`
      : null,
    fetcher,
  );

  if (!user) return null;

  async function refreshAll() {
    await Promise.all([
      mutate("/friends"),
      mutate("/friends/incoming"),
      mutate("/friends/outgoing"),
    ]);
  }

  async function sendRequest(target: string) {
    try {
      await apiFetch("/friends/request", {
        method: "POST",
        body: JSON.stringify({ target }),
      });
      await refreshAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function accept(id: number) {
    await apiFetch(`/friends/${id}/accept`, { method: "POST" });
    await refreshAll();
  }
  async function decline(id: number) {
    await apiFetch(`/friends/${id}/decline`, { method: "POST" });
    await refreshAll();
  }
  async function remove(id: number) {
    if (!confirm("Удалить из друзей?")) return;
    await apiFetch(`/friends/${id}`, { method: "DELETE" });
    await refreshAll();
  }

  const incomingCount = incoming.data?.length ?? 0;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "friends", label: "Друзья" },
    { id: "incoming", label: "Входящие", badge: incomingCount },
    { id: "outgoing", label: "Исходящие" },
    { id: "search", label: "Поиск" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card p-5">
        <h1 className="mb-1 font-display text-2xl font-semibold">Друзья</h1>
        <p className="text-sm text-white/60">
          Найди друзей по никнейму или ID, отправь заявку и общайся в личных
          сообщениях. Твой ID:{" "}
          {user.friend_id ? (
            <button
              onClick={() => {
                navigator.clipboard
                  ?.writeText(user.friend_id ?? "")
                  .catch(() => {});
              }}
              className="ml-1 rounded border border-bg-border bg-bg-elevated/60 px-2 py-0.5 font-mono text-xs text-white hover:border-brand-400"
            >
              #{user.friend_id}
            </button>
          ) : (
            <span className="font-mono text-xs text-white/50">— (обнови страницу)</span>
          )}
        </p>
      </div>

      <div className="card p-3">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-sm transition",
                tab === t.id
                  ? "bg-bg-elevated text-white"
                  : "text-white/70 hover:bg-bg-elevated/50",
              )}
            >
              {t.label}
              {t.badge ? (
                <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "friends" && (
        <div className="card divide-y divide-bg-border/40">
          {(friends.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-white/55">
              Пока никого нет — найди друзей в разделе «Поиск».
            </div>
          ) : (
            (friends.data ?? []).map((f) => (
              <FriendRow
                key={f.user.id}
                friend={f}
                onRemove={() => remove(f.friendship_id)}
              />
            ))
          )}
        </div>
      )}

      {tab === "incoming" && (
        <div className="card divide-y divide-bg-border/40">
          {(incoming.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-white/55">
              Нет входящих заявок.
            </div>
          ) : (
            (incoming.data ?? []).map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                primary={{ label: "Принять", onClick: () => accept(r.id) }}
                secondary={{ label: "Отклонить", onClick: () => decline(r.id) }}
              />
            ))
          )}
        </div>
      )}

      {tab === "outgoing" && (
        <div className="card divide-y divide-bg-border/40">
          {(outgoing.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-white/55">
              Нет исходящих заявок.
            </div>
          ) : (
            (outgoing.data ?? []).map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                secondary={{ label: "Отозвать", onClick: () => remove(r.id) }}
              />
            ))
          )}
        </div>
      )}

      {tab === "search" && (
        <div className="card space-y-3 p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Username или ID (только цифры)"
            className="field"
          />
          {query.trim().length > 0 && query.trim().length < 2 && (
            <div className="text-xs text-white/55">
              Введите минимум 2 символа.
            </div>
          )}
          <div className="divide-y divide-bg-border/40">
            {(search.data ?? []).map((u) => (
              <UserSearchRow
                key={u.id}
                u={u}
                onAdd={() => sendRequest(u.username)}
              />
            ))}
            {query.trim().length >= 2 &&
              !search.isLoading &&
              (search.data ?? []).length === 0 && (
                <div className="px-2 py-4 text-sm text-white/55">
                  Никого не нашли.
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

function FriendRow({
  friend,
  onRemove,
}: {
  friend: Friend;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <Link href={`/users?id=${friend.user.id}`} className="shrink-0">
        <Avatar
          username={friend.user.username}
          url={friend.user.avatar_url}
          size={48}
          shape="square"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/users?id=${friend.user.id}`}
            className="truncate font-medium hover:text-brand-300"
          >
            {friend.user.username}
          </Link>
          <UserOnlineDot userId={friend.user.id} />
          {friend.user.friend_id && (
            <span className="font-mono text-[10px] text-white/40">
              #{friend.user.friend_id}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-white/55">
          {friend.last_message ? (
            <>
              <span className="text-white/40">{formatRelative(friend.last_message_at!)}: </span>
              {friend.last_message}
            </>
          ) : (
            "Напишите первое сообщение"
          )}
        </div>
      </div>
      {friend.unread > 0 && (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
          {friend.unread}
        </span>
      )}
      <Link
        href={`/messages?with=${friend.user.username}`}
        className="rounded-md border border-bg-border px-2.5 py-1 text-xs text-white/80 hover:border-brand-400 hover:text-white"
      >
        Чат
      </Link>
      <button
        onClick={onRemove}
        className="rounded-md border border-bg-border px-2.5 py-1 text-xs text-white/55 hover:border-rose-400 hover:text-rose-300"
      >
        Удалить
      </button>
    </div>
  );
}

function RequestRow({
  request,
  primary,
  secondary,
}: {
  request: FriendRequest;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <Link href={`/users?id=${request.user.id}`} className="shrink-0">
        <Avatar
          username={request.user.username}
          url={request.user.avatar_url}
          size={48}
          shape="square"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/users?id=${request.user.id}`}
          className="truncate font-medium hover:text-brand-300"
        >
          {request.user.username}
        </Link>
        <div className="text-xs text-white/45">
          {formatRelative(request.created_at)}
          {request.user.friend_id && (
            <span className="ml-2 font-mono text-white/40">
              #{request.user.friend_id}
            </span>
          )}
        </div>
      </div>
      {primary && (
        <button
          onClick={primary.onClick}
          className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-400"
        >
          {primary.label}
        </button>
      )}
      {secondary && (
        <button
          onClick={secondary.onClick}
          className="rounded-md border border-bg-border px-3 py-1 text-xs text-white/70 hover:border-rose-400 hover:text-rose-300"
        >
          {secondary.label}
        </button>
      )}
    </div>
  );
}

function UserSearchRow({
  u,
  onAdd,
}: {
  u: PublicUser;
  onAdd: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 px-2 py-3">
      <Link href={`/users?id=${u.id}`} className="shrink-0">
        <Avatar username={u.username} url={u.avatar_url} size={44} shape="square" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/users?id=${u.id}`}
          className="truncate font-medium hover:text-brand-300"
        >
          {u.username}
        </Link>
        {u.friend_id && (
          <div className="font-mono text-[10px] text-white/45">
            #{u.friend_id}
          </div>
        )}
      </div>
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await onAdd();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-50"
      >
        Добавить
      </button>
    </div>
  );
}
