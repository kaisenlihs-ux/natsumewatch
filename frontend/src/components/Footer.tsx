"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";

export function Footer() {
  const { user } = useAuth();
  return (
    <footer className="mt-24 border-t border-bg-border/60 bg-bg-base/60">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <Logo />
          <p className="mt-3 text-sm text-white/60">
            NatsumeWatch — стриминговый плеер аниме на основе открытого API AniLibria.
            Дизайн вдохновлён современными платформами: тёмная тема, плавные анимации, стабильный
            HLS-плеер с адаптивным битрейтом.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-12 gap-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-white/40">Навигация</div>
            <Link href="/catalog" className="block text-white/80 hover:text-white">
              Каталог
            </Link>
            <Link href="/catalog?ongoing=1" className="block text-white/80 hover:text-white">
              Онгоинги
            </Link>
            <Link href="/random" className="block text-white/80 hover:text-white">
              Случайное
            </Link>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-white/40">Аккаунт</div>
            {user ? (
              <>
                <Link href="/profile" className="block text-white/80 hover:text-white">
                  Профиль
                </Link>
                <Link
                  href="/profile/lists"
                  className="block text-white/80 hover:text-white"
                >
                  Мои списки
                </Link>
                <Link
                  href="/profile/settings"
                  className="block text-white/80 hover:text-white"
                >
                  Настройки
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="block text-white/80 hover:text-white">
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="block text-white/80 hover:text-white"
                >
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-bg-border/60 py-4 text-center text-xs text-white/40">
        Контент предоставлен{" "}
        <a
          href="https://anilibria.top"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:underline"
        >
          AniLibria
        </a>
        . © {new Date().getFullYear()} NatsumeWatch.
      </div>
    </footer>
  );
}
