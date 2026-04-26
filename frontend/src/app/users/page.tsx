"use client";

import { Suspense } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { fetcher, resolveMediaUrl } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { UserOnlineDot } from "@/components/UserOnlineDot";
import {
  LIST_STATUSES,
  STATUS_LABELS,
  type ListItem,
  type PublicUser,
} from "@/lib/types";
import { posterUrl } from "@/lib/posters";

function PublicProfile() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const userSWR = useSWR<PublicUser>(id ? `/users/${id}` : null, fetcher);
  const listsSWR = useSWR<ListItem[]>(id ? `/users/${id}/lists` : null, fetcher);

  if (!id)
    return (
      <div className="card p-10 text-center text-white/60">
        Не указан id пользователя.
      </div>
    );

  if (userSWR.error)
    return (
      <div className="card p-10 text-center text-white/60">
        Пользователь не найден.
      </div>
    );

  if (!userSWR.data) return <div className="card p-10 text-white/55">Загрузка…</div>;

  const user = userSWR.data;
  const banner = resolveMediaUrl(user.banner_url);
  const lists = listsSWR.data ?? [];
  const grouped: Partial<Record<string, ListItem[]>> = {};
  for (const it of lists) (grouped[it.status] ??= []).push(it);

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="relative h-40 md:h-56">
          {banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/30 via-accent-600/20 to-bg-base" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-panel via-bg-panel/40 to-transparent" />
        </div>
        <div className="-mt-12 flex flex-col gap-4 px-5 pb-6 md:-mt-16 md:flex-row md:items-end md:gap-6 md:px-8">
          <Avatar
            username={user.username}
            url={user.avatar_url}
            size={112}
            className="border-4 border-bg-panel shadow-soft"
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold md:text-3xl">{user.username}</h1>
              <UserOnlineDot userId={user.id} showLabel className="text-white/70" />
            </div>
            {user.bio && <p className="mt-2 text-sm text-white/75">{user.bio}</p>}
            <div className="mt-1 text-xs text-white/40">
              Зарегистрирован {new Date(user.created_at).toLocaleDateString("ru-RU")}
            </div>
          </div>
        </div>
      </div>

      {LIST_STATUSES.map((s) => {
        const arr = grouped[s] ?? [];
        if (!arr.length) return null;
        return (
          <section key={s} className="card p-5">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-white/55">
              {STATUS_LABELS[s]} <span className="text-white/30">· {arr.length}</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
              {arr.slice(0, 12).map((it) => (
                <Link
                  key={it.id}
                  href={`/anime?slug=${it.release_alias ?? it.release_id}`}
                  className="group block"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-bg-elevated">
                    {it.release_poster && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={posterUrl(
                          { src: it.release_poster, preview: null, thumbnail: null },
                          "src",
                        )}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="mt-2 truncate text-sm">
                    {it.release_title ?? `#${it.release_id}`}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {!lists.length && (
        <div className="card p-8 text-center text-white/55">
          Этот пользователь пока не добавлял аниме в списки.
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="card p-10 text-white/55">Загрузка…</div>}>
      <PublicProfile />
    </Suspense>
  );
}
