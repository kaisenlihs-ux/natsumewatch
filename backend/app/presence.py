"""Lightweight in-memory presence tracker. Counts unique session ids seen recently."""

import time
from threading import Lock

from app.config import settings


class Presence:
    def __init__(self) -> None:
        self._seen: dict[str, float] = {}
        self._lock = Lock()

    def heartbeat(self, session_id: str) -> None:
        with self._lock:
            self._seen[session_id] = time.time()
            self._gc_locked()

    def online(self) -> int:
        with self._lock:
            self._gc_locked()
            return len(self._seen)

    def _gc_locked(self) -> None:
        cutoff = time.time() - settings.online_window_seconds
        stale = [k for k, ts in self._seen.items() if ts < cutoff]
        for k in stale:
            self._seen.pop(k, None)


presence = Presence()
