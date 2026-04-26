"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { ReleaseSummary } from "@/lib/types";

export default function RandomPage() {
  const router = useRouter();
  useEffect(() => {
    apiFetch<ReleaseSummary[]>("/anime/random?limit=1").then((d) => {
      const r = d?.[0];
      if (r) router.replace(`/anime?slug=${r.alias || r.id}`);
    });
  }, [router]);
  return (
    <div className="card grid place-items-center p-16 text-white/60">
      Подбираем случайный тайтл...
    </div>
  );
}
