"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LIST_STATUSES, STATUS_LABELS, type ListStatus } from "@/lib/types";
import Link from "next/link";

type Props = {
  releaseId: number;
  className?: string;
};

const PRIMARY: ListStatus[] = ["planned", "watching", "watched", "postponed", "dropped"];

/** Dropdown that lets a logged-in user assign the release to one of the
 *  mutually-exclusive status lists, plus toggle "favorite" independently. */
export function ListPicker({ releaseId, className }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<ListStatus[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const rect = btnRef.current!.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setStatuses(null);
      return;
    }
    apiFetch<ListStatus[]>(`/me/lists/by-release/${releaseId}`)
      .then((rows) => {
        if (alive) setStatuses(rows);
      })
      .catch(() => {
        if (alive) setStatuses([]);
      });
    return () => {
      alive = false;
    };
  }, [user, releaseId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      const portal = document.getElementById("list-picker-portal");
      if (portal && portal.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  if (!user) {
    return (
      <Link href="/login" className={clsx("btn-ghost", className)}>
        Войти, чтобы добавить
      </Link>
    );
  }

  const primary = statuses?.find((s) => s !== "favorite") ?? null;
  const isFav = !!statuses?.includes("favorite");

  async function setPrimary(next: ListStatus | null) {
    setBusy(true);
    try {
      if (next === null) {
        if (primary) {
          await apiFetch(`/me/lists?release_id=${releaseId}&status_value=${primary}`, {
            method: "DELETE",
          });
        }
        setStatuses((s) => (s ?? []).filter((x) => x !== primary));
      } else {
        await apiFetch("/me/lists", {
          method: "PUT",
          body: JSON.stringify({ release_id: releaseId, status: next }),
        });
        setStatuses((s) => {
          const cur = (s ?? []).filter((x) => x === "favorite");
          return [...cur, next];
        });
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function toggleFav() {
    setBusy(true);
    try {
      if (isFav) {
        await apiFetch(`/me/lists?release_id=${releaseId}&status_value=favorite`, {
          method: "DELETE",
        });
        setStatuses((s) => (s ?? []).filter((x) => x !== "favorite"));
      } else {
        await apiFetch("/me/lists", {
          method: "PUT",
          body: JSON.stringify({ release_id: releaseId, status: "favorite" }),
        });
        setStatuses((s) => [...(s ?? []), "favorite"]);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = primary ? STATUS_LABELS[primary] : "Добавить в список";

  return (
    <div ref={ref} className={clsx("flex items-center gap-2", className)}>
      <div className="relative">
        <button
          ref={btnRef}
          disabled={busy || statuses === null}
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            "btn",
            primary
              ? "bg-bg-elevated text-white border border-bg-border"
              : "btn-primary",
          )}
        >
          {primary ? "✓ " : "+ "}
          {label}
          <span className="ml-1 opacity-60">▾</span>
        </button>
        {open && mounted && coords &&
          createPortal(
            <div
              id="list-picker-portal"
              style={{
                position: "fixed",
                top: coords.top,
                right: coords.right,
                zIndex: 100,
              }}
              className="w-56 overflow-hidden rounded-xl border border-bg-border bg-bg-panel shadow-soft"
            >
              {PRIMARY.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrimary(s)}
                  className={clsx(
                    "block w-full px-4 py-2.5 text-left text-sm hover:bg-bg-elevated",
                    primary === s && "bg-bg-elevated text-brand-300",
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              {primary && (
                <button
                  onClick={() => setPrimary(null)}
                  className="block w-full border-t border-bg-border px-4 py-2.5 text-left text-sm text-brand-400 hover:bg-bg-elevated"
                >
                  Убрать из списка
                </button>
              )}
            </div>,
            document.body,
          )}
      </div>
      <button
        title={isFav ? "Убрать из избранного" : "В избранное"}
        disabled={busy || statuses === null}
        onClick={toggleFav}
        className={clsx(
          "btn-icon",
          isFav && "bg-brand-500/20 border-brand-500/40 text-brand-300",
        )}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
          <path
            d={
              isFav
                ? "M12 21s-7-4.5-9.5-9C.6 7.6 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23.4 7.6 21.5 12c-2.5 4.5-9.5 9-9.5 9z"
                : "M12 21s-7-4.5-9.5-9C.6 7.6 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23.4 7.6 21.5 12c-2.5 4.5-9.5 9-9.5 9zM12 18.4s5.6-3.7 7.7-7.4c1.1-2.3-.7-4.6-3.2-4.6-1.4 0-2.6.7-3.5 2L12 9.7l-1-1.3c-.9-1.3-2.1-2-3.5-2-2.5 0-4.3 2.3-3.2 4.6 2.1 3.7 7.7 7.4 7.7 7.4z"
            }
          />
        </svg>
      </button>
      {LIST_STATUSES.length === 0 && null}
    </div>
  );
}
