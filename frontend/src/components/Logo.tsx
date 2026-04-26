import Link from "next/link";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <span
        className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 shadow-glow"
        style={{ width: size + 8, height: size + 8 }}
      >
        <svg
          viewBox="0 0 24 24"
          className="text-white"
          width={size - 4}
          height={size - 4}
          fill="none"
        >
          <path
            d="M4 16c4-2 6-7 8-12 2 5 4 10 8 12-3 1-5 2-8 4-3-2-5-3-8-4Z"
            fill="currentColor"
            opacity="0.95"
          />
        </svg>
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        Natsume<span className="text-brand-400">Watch</span>
      </span>
    </Link>
  );
}
