"use client";
import Hls from "hls.js";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";

type Source = { url: string; quality: string };

export type PlayerProps = {
  sources: Source[];
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  initialTime?: number;
  onTimeUpdate?: (t: number) => void;
};

const QUALITY_ORDER = ["1080", "720", "480"];

function sortSources(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    const ai = QUALITY_ORDER.indexOf(a.quality);
    const bi = QUALITY_ORDER.indexOf(b.quality);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function Player({
  sources,
  poster,
  title,
  autoPlay,
  onEnded,
  initialTime = 0,
  onTimeUpdate,
}: PlayerProps) {
  const ordered = useMemo(() => sortSources(sources.filter((s) => !!s.url)), [sources]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [quality, setQuality] = useState<string>(ordered[0]?.quality || "");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [openMenu, setOpenMenu] = useState<"quality" | "speed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [subtitleTracks, setSubtitleTracks] = useState<
    { id: number; label: string }[]
  >([]);
  const [subtitleId, setSubtitleId] = useState<number>(-1);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSource = ordered.find((s) => s.quality === quality) || ordered[0];

  // ---- HLS attach ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) return;

    setError(null);
    const url = activeSource.url;
    const resumeAt = video.currentTime || initialTime || 0;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari, iOS)
      video.src = url;
      const onLoaded = () => {
        if (resumeAt > 1) video.currentTime = resumeAt;
        if (autoPlay) video.play().catch(() => {});
      };
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      return () => video.removeEventListener("loadedmetadata", onLoaded);
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      });
      hlsRef.current?.destroy();
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (resumeAt > 1) video.currentTime = resumeAt;
        if (autoPlay) video.play().catch(() => {});
      });
      const updateSubs = () => {
        const list = hls.subtitleTracks ?? [];
        setSubtitleTracks(
          list.map((t, i) => ({ id: i, label: t.name || t.lang || `Дорожка ${i + 1}` })),
        );
      };
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateSubs);
      hls.on(Hls.Events.MANIFEST_PARSED, updateSubs);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError("Не удалось загрузить видео. Попробуйте другое качество.");
          }
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    setError("Браузер не поддерживает воспроизведение HLS.");
  }, [activeSource, autoPlay, initialTime]);

  // ---- Video event wiring ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCurrent(v.currentTime);
      onTimeUpdate?.(v.currentTime);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onMeta = () => setDuration(v.duration || 0);
    const onVol = () => {
      setMuted(v.muted);
      setVolume(v.volume);
    };
    const onEnd = () => onEnded?.();
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("volumechange", onVol);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("volumechange", onVol);
      v.removeEventListener("ended", onEnd);
    };
  }, [onEnded, onTimeUpdate]);

  // ---- Apply subtitle selection ----
  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = subtitleId;
      hlsRef.current.subtitleDisplay = subtitleId !== -1;
    }
    const v = videoRef.current;
    if (v) {
      const tracks = v.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = i === subtitleId ? "showing" : "disabled";
      }
    }
  }, [subtitleId, subtitleTracks]);

  // ---- Auto-hide controls ----
  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) setShowControls(false);
    }, 2500);
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!wrapRef.current) return;
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      if (e.key === " " || e.key.toLowerCase() === "k") {
        e.preventDefault();
        v.paused ? v.play() : v.pause();
      } else if (e.key === "ArrowRight") {
        v.currentTime = Math.min(v.currentTime + 5, v.duration);
      } else if (e.key === "ArrowLeft") {
        v.currentTime = Math.max(v.currentTime - 5, 0);
      } else if (e.key.toLowerCase() === "m") {
        v.muted = !v.muted;
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (e.key === "ArrowUp") {
        v.volume = Math.min(1, v.volume + 0.05);
      } else if (e.key === "ArrowDown") {
        v.volume = Math.max(0, v.volume - 0.05);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }
  function toggleFullscreen() {
    const w = wrapRef.current;
    if (!w) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else w.requestFullscreen?.();
  }
  function seekTo(pct: number) {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.max(0, Math.min(duration, pct * duration));
  }

  return (
    <div
      ref={wrapRef}
      className={clsx("player-wrap group", showControls && "show-controls")}
      onMouseMove={bumpControls}
      onMouseLeave={() => setShowControls(false)}
      onClick={(e) => {
        // Tap-to-toggle on mobile, but ignore clicks on controls
        if ((e.target as HTMLElement).closest(".player-controls")) return;
        togglePlay();
      }}
    >
      <video ref={videoRef} poster={poster} playsInline preload="metadata" />

      {error && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/70 px-6 text-center text-sm">
          {error}
        </div>
      )}

      {!playing && (
        <button
          aria-label="Воспроизвести"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 z-[5] m-auto grid h-20 w-20 place-items-center rounded-full bg-brand-500/95 text-white shadow-glow transition hover:bg-brand-400"
          style={{ inset: 0 }}
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9 translate-x-0.5" fill="currentColor">
            <path d="M8 5v14l11-7L8 5Z" />
          </svg>
        </button>
      )}

      <div className="player-controls" onClick={(e) => e.stopPropagation()}>
        {title && <div className="text-sm text-white/80 line-clamp-1">{title}</div>}

        <ProgressBar
          duration={duration}
          current={current}
          buffered={buffered}
          onSeek={seekTo}
        />

        <div className="flex items-center gap-3">
          <ControlBtn onClick={togglePlay} label={playing ? "Пауза" : "Играть"}>
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            )}
          </ControlBtn>
          <ControlBtn
            onClick={() => {
              const v = videoRef.current;
              if (v) v.currentTime = Math.max(0, v.currentTime - 10);
            }}
            label="-10s"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 4v6h6M21 12a9 9 0 1 1-3-6.7L21 8" strokeLinecap="round" />
            </svg>
          </ControlBtn>
          <ControlBtn
            onClick={() => {
              const v = videoRef.current;
              if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10);
            }}
            label="+10s"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 4v6h-6M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" />
            </svg>
          </ControlBtn>

          <div className="flex items-center gap-2 group/vol">
            <ControlBtn onClick={toggleMute} label="Звук">
              {muted || volume === 0 ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M3 9v6h4l5 4V5L7 9H3Zm13.5 3 2.5 2.5 1.4-1.4L17.9 12l2.5-2.5-1.4-1.4-2.5 2.5-2.5-2.5-1.4 1.4 2.5 2.5-2.5 2.5 1.4 1.4 2.5-2.5Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M3 9v6h4l5 4V5L7 9H3Zm13.5-3.5a7 7 0 0 1 0 13l-1.4-1.4a5 5 0 0 0 0-10.2l1.4-1.4Z" />
                </svg>
              )}
            </ControlBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                v.volume = Number(e.target.value);
                v.muted = Number(e.target.value) === 0;
              }}
              className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-brand-500 group-hover/vol:block"
            />
          </div>

          <div className="ml-2 hidden text-xs tabular-nums text-white/70 sm:block">
            {formatDuration(current)} / {formatDuration(duration)}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <ControlBtn
                onClick={() =>
                  setOpenMenu((m) => (m === "quality" ? null : "quality"))
                }
                label="Качество"
                active={openMenu === "quality"}
              >
                <span className="text-[11px] font-semibold tabular-nums">
                  {quality ? `${quality}p` : "HD"}
                </span>
              </ControlBtn>
              {openMenu === "quality" && (
                <Menu title="Качество">
                  {ordered.map((s) => (
                    <MenuItem
                      key={s.quality}
                      active={quality === s.quality}
                      onClick={() => {
                        setQuality(s.quality);
                        setOpenMenu(null);
                      }}
                    >
                      {s.quality}p
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </div>
            <div className="relative">
              <ControlBtn
                onClick={() =>
                  setOpenMenu((m) => (m === "speed" ? null : "speed"))
                }
                label="Скорость"
                active={openMenu === "speed"}
              >
                <span className="text-[11px] font-semibold tabular-nums">
                  {rate}x
                </span>
              </ControlBtn>
              {openMenu === "speed" && (
                <Menu title="Скорость">
                  {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <MenuItem
                      key={r}
                      active={rate === r}
                      onClick={() => {
                        setRate(r);
                        const v = videoRef.current;
                        if (v) v.playbackRate = r;
                        setOpenMenu(null);
                      }}
                    >
                      {r}x
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </div>
            <ControlBtn
              onClick={() => {
                if (!subtitleTracks.length) return;
                setSubtitleId((id) => (id === -1 ? 0 : -1));
              }}
              label={
                subtitleTracks.length
                  ? subtitleId !== -1
                    ? "Субтитры выкл"
                    : "Субтитры вкл"
                  : "Субтитры недоступны"
              }
              active={subtitleId !== -1}
              disabled={!subtitleTracks.length}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="M6.5 14h3M11.5 14h6M6.5 11h6M14.5 11h3" />
              </svg>
            </ControlBtn>
            <ControlBtn onClick={toggleFullscreen} label="Во весь экран">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" />
              </svg>
            </ControlBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({
  onClick,
  label,
  children,
  active,
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={clsx(
        "grid h-9 min-w-[2.25rem] place-items-center rounded-full px-2 text-white/85 transition",
        disabled && "cursor-not-allowed opacity-40",
        !disabled && "hover:bg-white/10 hover:text-white",
        active && !disabled && "bg-white/15 text-white",
      )}
    >
      {children}
    </button>
  );
}

function Menu({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute bottom-12 right-0 w-40 overflow-hidden rounded-xl border border-bg-border bg-bg-panel/95 text-sm shadow-soft backdrop-blur">
      <div className="border-b border-bg-border px-3 py-2 text-xs uppercase tracking-wide text-white/50">
        {title}
      </div>
      {children}
    </div>
  );
}

function MenuItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-elevated",
        active && "text-brand-400",
      )}
    >
      {children}
      {active && <span>✓</span>}
    </button>
  );
}

function ProgressBar({
  duration,
  current,
  buffered,
  onSeek,
}: {
  duration: number;
  current: number;
  buffered: number;
  onSeek: (pct: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const buf = duration > 0 ? (buffered / duration) * 100 : 0;
  const handle = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    onSeek(Math.max(0, Math.min(1, x / rect.width)));
  };
  return (
    <div
      ref={ref}
      className="player-progress"
      onClick={(e) => handle(e.clientX)}
      role="slider"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${buf}%` }} />
      <div className="player-progress-fill" style={{ width: `${pct}%` }} />
      <div className="player-progress-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}
