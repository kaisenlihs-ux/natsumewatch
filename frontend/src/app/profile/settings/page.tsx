"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, init } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (!user) return <div className="card p-10 text-white/60">Загрузка…</div>;

  async function setHistoryEnabled(enabled: boolean) {
    setBusy(true);
    try {
      const u = await apiFetch<User>("/me", {
        method: "PATCH",
        body: JSON.stringify({ history_enabled: enabled }),
      });
      useAuth.setState({ user: u });
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (!confirm("Полностью очистить историю просмотра?")) return;
    setBusy(true);
    try {
      await apiFetch("/me/history", { method: "DELETE" });
      alert("История очищена");
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    try {
      const u = await apiFetch<User>("/me/avatar", { method: "DELETE" });
      useAuth.setState({ user: u });
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner() {
    setBusy(true);
    try {
      const u = await apiFetch<User>("/me/banner", { method: "DELETE" });
      useAuth.setState({ user: u });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Настройки профиля</h1>
        <Link href="/profile" className="text-sm text-white/60 hover:text-white">
          ← Профиль
        </Link>
      </div>

      <section className="card divide-y divide-bg-border/40">
        <SettingRow
          title="История просмотра"
          description="Отслеживание серий, которые ты запускаешь. Видна только тебе."
        >
          <button
            disabled={busy}
            onClick={() => setHistoryEnabled(!user.history_enabled)}
            className={`inline-flex h-7 w-12 items-center rounded-full border transition ${
              user.history_enabled
                ? "border-emerald-400/40 bg-emerald-500/30"
                : "border-bg-border bg-bg-elevated"
            }`}
            aria-label="История просмотра"
          >
            <span
              className={`mx-1 inline-block h-5 w-5 rounded-full bg-white transition ${
                user.history_enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </SettingRow>
        <SettingRow
          title="Очистить историю"
          description="Удалить все записи. Это действие необратимо."
        >
          <button onClick={clearHistory} disabled={busy} className="btn-ghost text-brand-400">
            Очистить
          </button>
        </SettingRow>
      </section>

      <section className="card divide-y divide-bg-border/40">
        <SettingRow title="Аватар" description="PNG, JPG, GIF или WebP, до 5 МБ.">
          {user.avatar_url ? (
            <button onClick={removeAvatar} disabled={busy} className="btn-ghost text-brand-400">
              Удалить
            </button>
          ) : (
            <span className="text-xs text-white/45">не установлен</span>
          )}
        </SettingRow>
        <SettingRow title="Баннер" description="PNG, JPG, GIF или WebP, до 5 МБ.">
          {user.banner_url ? (
            <button onClick={removeBanner} disabled={busy} className="btn-ghost text-brand-400">
              Удалить
            </button>
          ) : (
            <span className="text-xs text-white/45">не установлен</span>
          )}
        </SettingRow>
      </section>

      <p className="text-xs text-white/40">
        Изменить аватар или баннер можно прямо на странице профиля — нажми кнопку
        «Сменить» рядом с ними.
      </p>
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="text-xs text-white/55">{description}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
