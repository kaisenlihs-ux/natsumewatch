"use client";

import Link from "next/link";
import useSWR from "swr";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiUpload, fetcher, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { StatsPie } from "@/components/StatsPie";
import { UserOnlineDot } from "@/components/UserOnlineDot";
import {
  type HistoryEntry,
  type ListItem,
  type ListStatus,
  type ProfileStats,
  type User,
  STATUS_LABELS,
} from "@/lib/types";
import { posterUrl } from "@/lib/posters";
import { formatRelative } from "@/lib/format";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, init, logout } = useAuth();

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const stats = useSWR<ProfileStats>(user ? "/me/stats" : null, fetcher);
  const recentLists = useSWR<ListItem[]>(user ? "/me/lists" : null, fetcher);
  const history = useSWR<HistoryEntry[]>(
    user && user.history_enabled ? "/me/history?limit=12" : null,
    fetcher,
  );

  if (!user)
    return (
      <div className="card grid place-items-center p-16 text-white/60">
        Загрузка…
      </div>
    );

  const s = stats.data;

  return (
    <div className="space-y-6">
      <ProfileHeader user={user} />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="Просмотрено" value={s?.total_watched ?? 0} accent />
        <StatCard label="Смотрю" value={s?.total_watching ?? 0} />
        <StatCard label="В плане" value={s?.total_planned ?? 0} />
        <StatCard label="Отложено" value={s?.total_postponed ?? 0} />
        <StatCard label="Брошено" value={s?.total_dropped ?? 0} />
        <StatCard label="Избранное" value={s?.total_favorite ?? 0} accent />
      </div>

      {/* Pies */}
      {s && (s.by_genre.length > 0 || s.by_type.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 text-sm uppercase tracking-wider text-white/55">
              По жанрам
            </h3>
            <StatsPie data={s.by_genre} />
          </div>
          <div className="card p-5">
            <h3 className="mb-3 text-sm uppercase tracking-wider text-white/55">
              По типу контента
            </h3>
            <StatsPie data={s.by_type} />
          </div>
        </div>
      )}

      {/* Recent lists by status */}
      <RecentLists items={recentLists.data ?? []} />

      {/* History */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm uppercase tracking-wider text-white/55">
            История просмотра
          </h3>
          <Link href="/profile/settings" className="text-xs text-white/50 hover:text-white">
            {user.history_enabled ? "Настройки" : "История отключена · Настройки"}
          </Link>
        </div>
        {!user.history_enabled ? (
          <p className="text-sm text-white/55">
            История отключена. Включить можно в настройках профиля.
          </p>
        ) : history.data && history.data.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {history.data.map((h) => (
              <Link
                key={h.id}
                href={`/anime?slug=${h.release_alias ?? h.release_id}`}
                className="flex gap-3 rounded-xl border border-bg-border/50 bg-bg-elevated/40 p-2 transition hover:border-bg-border"
              >
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md bg-bg-elevated">
                  {h.release_poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl(
                        { src: h.release_poster, preview: null, thumbnail: null },
                        "src",
                      )}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {h.release_title || `#${h.release_id}`}
                  </div>
                  <div className="truncate text-xs text-white/55">
                    Серия {h.episode_ordinal}
                    {h.source_studio ? ` · ${h.source_studio}` : ""}
                  </div>
                  <div className="text-xs text-white/35">
                    {formatRelative(h.watched_at)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/55">
            Пока пусто. Запусти любую серию — она появится здесь.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/profile/lists" className="btn-ghost">
          Все списки
        </Link>
        <Link href="/profile/settings" className="btn-ghost">
          Настройки
        </Link>
        <Link href="/catalog" className="btn-ghost">
          Каталог
        </Link>
        <button onClick={logout} className="btn-ghost text-brand-400">
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`card p-4 text-center ${accent ? "ring-1 ring-brand-500/30" : ""}`}
    >
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-white/45">{label}</div>
    </div>
  );
}

function setUser(u: User) {
  useAuth.setState({ user: u });
}

function ProfileHeader({ user }: { user: User }) {
  const [bio, setBio] = useState(user.bio ?? "");
  const [editingBio, setEditingBio] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const u = await apiUpload<User>("/me/avatar", form);
      setUser(u);
    } catch (e) {
      alert(`Не удалось загрузить аватар: ${e instanceof Error ? e.message : e}`);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function uploadBanner(file: File) {
    setBannerBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const u = await apiUpload<User>("/me/banner", form);
      setUser(u);
    } catch (e) {
      alert(`Не удалось загрузить баннер: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBannerBusy(false);
    }
  }

  async function saveBio() {
    try {
      const u = await apiFetch<User>("/me", {
        method: "PATCH",
        body: JSON.stringify({ bio }),
      });
      setUser(u);
      setEditingBio(false);
    } catch (e) {
      alert(`Не удалось сохранить: ${e instanceof Error ? e.message : e}`);
    }
  }

  const bannerSrc = resolveMediaUrl(user.banner_url);

  return (
    <div className="card overflow-hidden">
      <div className="relative h-44 w-full md:h-56">
        {bannerSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/30 via-accent-600/20 to-bg-base" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-panel via-bg-panel/30 to-transparent" />
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            disabled={bannerBusy}
            onClick={() => bannerInput.current?.click()}
            className="btn-ghost h-9"
          >
            {bannerBusy ? "Загрузка…" : bannerSrc ? "Сменить баннер" : "Загрузить баннер"}
          </button>
          <input
            ref={bannerInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadBanner(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="-mt-12 flex flex-col gap-4 px-5 pb-6 md:-mt-16 md:flex-row md:items-end md:gap-6 md:px-8">
        <div className="relative">
          <Avatar
            username={user.username}
            url={user.avatar_url}
            size={128}
            className="border-4 border-bg-panel shadow-soft"
          />
          <button
            disabled={avatarBusy}
            onClick={() => avatarInput.current?.click()}
            className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border border-bg-border bg-bg-base text-white/80 hover:bg-bg-elevated"
            title="Сменить аватар"
          >
            {avatarBusy ? "…" : "✎"}
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold md:text-3xl">{user.username}</h1>
            <UserOnlineDot userId={user.id} showLabel className="text-white/70" />
          </div>
          <div className="text-sm text-white/55">{user.email}</div>
          {user.friend_id && (
            <div className="flex items-center gap-2 text-xs text-white/55">
              <span>ID для друзей:</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(user.friend_id ?? "").catch(() => {});
                }}
                className="rounded-md border border-bg-border bg-bg-elevated/50 px-2 py-0.5 font-mono text-xs text-white hover:border-brand-400"
                title="Скопировать"
              >
                #{user.friend_id}
              </button>
            </div>
          )}
          <div className="text-xs text-white/40">
            Зарегистрирован {new Date(user.created_at).toLocaleDateString("ru-RU")}
          </div>
          {editingBio ? (
            <div className="mt-2 flex gap-2">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="field flex-1"
                rows={2}
                maxLength={2000}
                placeholder="О себе…"
              />
              <div className="flex flex-col gap-2">
                <button onClick={saveBio} className="btn-primary h-9">
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setBio(user.bio ?? "");
                    setEditingBio(false);
                  }}
                  className="btn-ghost h-9"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingBio(true)}
              className="mt-1 text-left text-sm text-white/75 hover:text-white"
              title="Нажми чтобы изменить"
            >
              {user.bio || <span className="italic text-white/40">+ добавить описание о себе</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentLists({ items }: { items: ListItem[] }) {
  const grouped: Partial<Record<ListStatus, ListItem[]>> = {};
  for (const it of items) {
    (grouped[it.status] ??= []).push(it);
  }
  const order: ListStatus[] = [
    "watching",
    "planned",
    "watched",
    "favorite",
    "postponed",
    "dropped",
  ];
  const visible = order.filter((s) => (grouped[s]?.length ?? 0) > 0);
  if (!visible.length) {
    return (
      <div className="card p-6 text-sm text-white/55">
        Пока пусто. Добавь любой тайтл в список со страницы аниме.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {visible.map((status) => (
        <section key={status} className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-wider text-white/55">
              {STATUS_LABELS[status]}{" "}
              <span className="text-white/30">· {grouped[status]!.length}</span>
            </h3>
            <Link
              href={`/profile/lists?status=${status}`}
              className="text-xs text-white/50 hover:text-white"
            >
              Все →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {(grouped[status] ?? []).slice(0, 6).map((it) => (
              <Link
                key={it.id}
                href={`/anime?slug=${it.release_alias ?? it.release_id}`}
                className="group block"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-bg-elevated">
                  {it.release_poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl(
                        { src: it.release_poster, preview: null, thumbnail: null },
                        "src",
                      )}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="mt-2 truncate text-sm">
                  {it.release_title ?? `#${it.release_id}`}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
