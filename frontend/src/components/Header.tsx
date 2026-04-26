"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { OnlineBadge } from "./OnlineBadge";
import { SearchBox } from "./SearchBox";
import { useAuth } from "@/lib/auth";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function Header() {
  const { user, init, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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

  return (
    <header className="sticky top-0 z-40 border-b border-bg-border/60 bg-bg-base/70 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {[
            { href: "/", label: "Главная" },
            { href: "/catalog", label: "Каталог" },
            { href: "/catalog?ongoing=1", label: "Онгоинги" },
            { href: "/random", label: "Случайное" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "rounded-full px-3 py-1.5 text-sm transition",
                pathname === l.href.split("?")[0]
                  ? "bg-bg-elevated text-white"
                  : "text-white/70 hover:text-white hover:bg-bg-panel/60",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <SearchBox />

        <OnlineBadge className="hidden lg:flex" />

        {user ? (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-bg-border bg-bg-panel/70 py-1 pl-1 pr-3 transition hover:bg-bg-elevated"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 text-xs font-bold uppercase">
                {user.username.slice(0, 1)}
              </span>
              <span className="text-sm">{user.username}</span>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-bg-border bg-bg-panel shadow-soft">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-sm hover:bg-bg-elevated"
                >
                  Профиль
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-brand-400 hover:bg-bg-elevated"
                >
                  Выйти
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden sm:flex gap-2">
            <Link href="/login" className="btn-ghost">
              Войти
            </Link>
            <Link href="/register" className="btn-primary">
              Регистрация
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
