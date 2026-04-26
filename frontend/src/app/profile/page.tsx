"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, init, logout } = useAuth();

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (!user)
    return (
      <div className="card grid place-items-center p-16 text-white/60">
        Загрузка...
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 text-2xl font-bold uppercase">
            {user.username.slice(0, 1)}
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold">{user.username}</h1>
            <p className="text-sm text-white/60">{user.email}</p>
            <p className="text-xs text-white/40">
              Зарегистрирован {new Date(user.created_at).toLocaleDateString("ru-RU")}
            </p>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <h2 className="mb-3 text-lg font-semibold">Действия</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/catalog" className="btn-ghost">
            Открыть каталог
          </Link>
          <button onClick={logout} className="btn-ghost text-brand-400">
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
