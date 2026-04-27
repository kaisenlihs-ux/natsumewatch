"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { OnlineBadge } from "./OnlineBadge";
import { SearchBox } from "./SearchBox";
import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/auth";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог" },
  { href: "/catalog?ongoing=1", label: "Онгоинги" },
  { href: "/random", label: "Случайное" },
];

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Header() {
  const { user, init, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    setMobileNav(false);
    setMobileSearch(false);
    setOpen(false);
  }, [pathname]);

  const profileButton = user ? (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-bg-border bg-bg-panel/70 py-1 pl-1 pr-3 transition hover:bg-bg-elevated"
      >
        <Avatar username={user.username} url={user.avatar_url} size={28} className="ring-0" />
        <span className="hidden text-sm sm:block">{user.username}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-bg-border bg-bg-panel shadow-soft">
          <Link href="/profile" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-bg-elevated">
            Профиль
          </Link>
          <Link href="/profile/lists?status=watching" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-bg-elevated">
            Мои списки
          </Link>
          <Link href="/profile/settings" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-bg-elevated">
            Настройки
          </Link>
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="block w-full border-t border-bg-border px-4 py-2.5 text-left text-sm text-brand-400 hover:bg-bg-elevated"
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  ) : (
    <Link href="/login" className="btn-icon" aria-label="Войти">
      <Icon path="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h11M9 21h6" />
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-bg-border/60 bg-bg-base/70 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "rounded-full px-3 py-1.5 text-sm transition",
                pathname === l.href.split("?")[0]
                  ? "bg-bg-elevated text-white"
                  : "text-white/70 hover:bg-bg-panel/60 hover:text-white",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="hidden w-full max-w-md md:block">
          <SearchBox />
        </div>

        <OnlineBadge className="hidden lg:flex" />

        <div className="ml-auto flex items-center gap-1.5 md:hidden">
          <button
            className="btn-icon"
            aria-label="Поиск"
            onClick={() => setMobileSearch(true)}
          >
            <Icon path="M11 19a8 8 0 1 1 5.3-14l4.7 4.7-1.4 1.4-4.7-4.7A6 6 0 1 0 17 11" />
          </button>
          {profileButton}
          <button
            className="btn-icon"
            aria-label="Меню"
            onClick={() => setMobileNav((v) => !v)}
          >
            <Icon path="M4 7h16M4 12h16M4 17h16" />
          </button>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {profileButton}
          {!user && (
            <>
              <Link href="/login" className="btn-ghost">Войти</Link>
              <Link href="/register" className="btn-primary">Регистрация</Link>
            </>
          )}
        </div>
      </div>

      {mobileSearch && (
        <div className="border-t border-bg-border/60 bg-bg-base/95 p-4 md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Поиск</div>
            <button className="text-sm text-white/60" onClick={() => setMobileSearch(false)}>
              Закрыть
            </button>
          </div>
          <SearchBox mobile onNavigate={() => setMobileSearch(false)} />
        </div>
      )}

      {mobileNav && (
        <div className="border-t border-bg-border/60 bg-bg-base/95 md:hidden">
          <nav className="container-page grid gap-1 py-3">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileNav(false)}
                className="rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-bg-elevated hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/profile" className="rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-bg-elevated hover:text-white">Профиль</Link>
                <Link href="/profile/lists?status=watching" className="rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-bg-elevated hover:text-white">Мои списки</Link>
                <Link href="/profile/settings" className="rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-bg-elevated hover:text-white">Настройки</Link>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-bg-elevated hover:text-white">Войти</Link>
                <Link href="/register" className="rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-bg-elevated hover:text-white">Регистрация</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
