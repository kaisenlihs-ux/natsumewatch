"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

type Tab = {
  href: string;
  label: string;
  iconPath: string;
  /** When set, only matches when this query param has the given value. */
  match: (pathname: string, params: URLSearchParams) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Главная",
    iconPath:
      "M3 12 12 4l9 8M5 10v9h4v-5h6v5h4v-9",
    match: (p) => p === "/",
  },
  {
    href: "/catalog?sorting=RATING_DESC",
    label: "Топ 100",
    iconPath:
      "M12 3 14.5 9.1 21 9.6l-5 4.3 1.6 6.5L12 17l-5.6 3.4L8 13.9 3 9.6l6.5-.5L12 3Z",
    match: (p, params) =>
      p.startsWith("/catalog") && params.get("sorting") === "RATING_DESC",
  },
  {
    href: "/catalog",
    label: "Каталог",
    iconPath:
      "M4 6h16M4 12h16M4 18h16",
    match: (p, params) =>
      p.startsWith("/catalog") && params.get("sorting") !== "RATING_DESC",
  },
  {
    href: "/random",
    label: "Случайное",
    iconPath:
      "M4 4h6L20 20h-4l-2-3M20 4h-4l-3 4M4 20h6l3-4",
    match: (p) => p.startsWith("/random"),
  },
];

export function MobileBottomNav() {
  const pathname = usePathname() || "/";
  const sp = useSearchParams();
  const params = new URLSearchParams(sp?.toString() || "");

  return (
    <nav
      aria-label="Нижняя навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-bg-border/70 bg-bg-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.match(pathname, params);
          return (
            <li key={t.label}>
              <Link
                href={t.href}
                className={clsx(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition",
                  active ? "text-brand-300" : "text-white/65 hover:text-white",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={t.iconPath} />
                </svg>
                <span className="leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
