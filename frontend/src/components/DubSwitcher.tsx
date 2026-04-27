"use client";

import clsx from "clsx";
import { useState } from "react";
import type { DubSource } from "@/lib/types";

const LANG_LABEL: Record<string, { label: string; flag: string }> = {
  ru: { label: "Русский", flag: "🇷🇺" },
  en: { label: "English", flag: "🇬🇧" },
  ja: { label: "日本語 (оригинал)", flag: "🇯🇵" },
};

// Show this many sources per language when collapsed.
const COLLAPSED_LIMIT = 4;

function sourceKey(s: DubSource): string {
  return `${s.provider}::${s.studio}::${s.kind}`;
}

export function DubSwitcher({
  sources,
  active,
  onPick,
}: {
  sources: DubSource[];
  active: DubSource | null;
  onPick: (s: DubSource) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!sources.length) return null;

  // Group by language
  const groups = new Map<string, DubSource[]>();
  const order: string[] = [];
  for (const s of sources) {
    const lang = s.language;
    if (!groups.has(lang)) {
      groups.set(lang, []);
      order.push(lang);
    }
    groups.get(lang)!.push(s);
  }

  // Sort each group by descending episode count so the "best" sources surface
  // first when collapsed.
  for (const arr of groups.values()) {
    arr.sort((a, b) => (b.episodes_count ?? 0) - (a.episodes_count ?? 0));
  }

  const activeKey = active ? sourceKey(active) : null;
  const totalShown = order.reduce(
    (sum, l) => sum + Math.min(groups.get(l)!.length, COLLAPSED_LIMIT),
    0,
  );
  const canCollapse = sources.length > totalShown;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-white/55">
          Озвучка / язык
        </div>
        <div className="text-xs text-white/45">
          {sources.length} источников
        </div>
      </div>
      <div className="space-y-3">
        {order.map((lang) => {
          const meta = LANG_LABEL[lang] ?? { label: lang.toUpperCase(), flag: "🌐" };
          const fullItems = groups.get(lang)!;
          // When collapsed, show the top N — but always include the active
          // source so picking a deep cut and then re-collapsing doesn't hide it.
          let items = fullItems;
          if (!expanded && fullItems.length > COLLAPSED_LIMIT) {
            const top = fullItems.slice(0, COLLAPSED_LIMIT);
            const activeInGroup = fullItems.find((s) => sourceKey(s) === activeKey);
            if (activeInGroup && !top.includes(activeInGroup)) top.push(activeInGroup);
            items = top;
          }
          return (
            <div key={lang}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-white/55">
                <span>{meta.flag}</span>
                <span>{meta.label}</span>
              </div>
              <div key={`${lang}-${expanded ? "x" : "c"}`} className="animate-fade-in flex flex-wrap gap-1.5">
                {items.map((s) => {
                  const k = sourceKey(s);
                  const isActive = k === activeKey;
                  return (
                    <button
                      key={k}
                      onClick={() => onPick(s)}
                      title={`${s.studio} · ${s.episodes_count} эп.`}
                      className={clsx(
                        "group rounded-full border px-3 py-1.5 text-xs transition",
                        isActive
                          ? "border-brand-400 bg-brand-500/15 text-brand-100"
                          : "border-bg-border bg-bg-panel/60 text-white/75 hover:border-white/40 hover:text-white",
                      )}
                    >
                      <span className="font-medium">{s.studio}</span>
                      {s.kind === "subtitles" && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-white/55">
                          субтитры
                        </span>
                      )}
                      {s.provider === "anilibria" && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-300" title="Свой плеер с HLS" />
                      )}
                      <span className="ml-1.5 text-[10px] text-white/45 group-hover:text-white/65">
                        {s.episodes_count}ep
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-brand-200 hover:text-brand-100"
        >
          {expanded ? "Свернуть" : `Показать все (${sources.length})`}
        </button>
      )}
    </div>
  );
}
