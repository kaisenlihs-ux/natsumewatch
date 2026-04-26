"use client";

/**
 * Embeds the official Kodik iframe player. Kodik does not allow swapping in a
 * custom HTML5 element — we have to use their iframe. We pass a stable `key`
 * from the parent so React fully remounts the iframe when the user switches
 * episode/dub.
 */
export function KodikPlayer({ src, title }: { src: string; title?: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-bg-border bg-black shadow-soft">
      <iframe
        src={src}
        title={title || "Kodik player"}
        className="absolute inset-0 h-full w-full"
        allow="autoplay *; fullscreen *; picture-in-picture *"
        allowFullScreen
        referrerPolicy="no-referrer"
        sandbox="allow-same-origin allow-scripts allow-presentation allow-forms allow-popups"
      />
    </div>
  );
}
