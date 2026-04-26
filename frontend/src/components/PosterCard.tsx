import Image from "next/image";
import Link from "next/link";
import type { ReleaseSummary } from "@/lib/types";
import { posterUrl } from "@/lib/posters";

export function PosterCard({ r }: { r: ReleaseSummary }) {
  return (
    <Link
      href={`/anime/${r.alias || r.id}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-xl border border-bg-border/60 bg-bg-panel transition hover:-translate-y-1 hover:shadow-glow"
    >
      <Image
        src={posterUrl(r.poster, "src")}
        alt={r.name.main}
        fill
        sizes="(min-width:1280px) 200px, (min-width:768px) 22vw, 45vw"
        className="object-cover transition duration-500 group-hover:scale-105"
        unoptimized
      />
      <div className="absolute inset-0 bg-card-fade opacity-90" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="line-clamp-2 text-sm font-semibold leading-tight">{r.name.main}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
          <span>{r.year}</span>
          {r.type?.description && (
            <>
              <span>·</span>
              <span>{r.type.description}</span>
            </>
          )}
          {r.is_ongoing && (
            <span className="ml-auto rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-medium text-brand-300">
              Онгоинг
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function PosterCardSkeleton() {
  return (
    <div className="skeleton aspect-[2/3] rounded-xl" />
  );
}
