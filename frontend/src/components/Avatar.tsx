"use client";

import clsx from "clsx";
import { resolveMediaUrl } from "@/lib/api";

type Props = {
  username: string;
  url: string | null | undefined;
  size?: number;
  className?: string;
};

export function Avatar({ username, url, size = 64, className }: Props) {
  const resolved = resolveMediaUrl(url ?? null);
  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={username}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={clsx(
          "rounded-full object-cover ring-2 ring-bg-border/50",
          className,
        )}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size / 2.6 }}
      className={clsx(
        "grid place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 font-bold uppercase text-white",
        className,
      )}
    >
      {username.slice(0, 1)}
    </span>
  );
}
