"""Shikimori API client.

We use Shikimori for one specific job: text search by Russian/English/romaji
that returns shikimori IDs. This lets the hybrid catalog find titles by
their Russian name (Kodik's text search is Latin-only) and then resolve
playback through Kodik via ``shikimori_id``.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "https://shikimori.one/api"


class ShikimoriClient:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(
            timeout=10.0,
            headers={"User-Agent": "NatsumeWatch/1.0"},
        )
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = 60 * 30

    async def close(self) -> None:
        await self._http.aclose()

    async def search(self, query: str, *, limit: int = 12) -> list[dict[str, Any]]:
        q = (query or "").strip()
        if not q:
            return []
        cache_key = f"search::{q}::{limit}"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        try:
            r = await self._http.get(
                f"{_BASE_URL}/animes",
                params={"search": q, "limit": min(limit, 30)},
            )
            r.raise_for_status()
            data = r.json()
        except Exception as exc:  # noqa: BLE001
            logger.info("shikimori search failed: %s", exc)
            return []

        if not isinstance(data, list):
            return []
        self._cache[cache_key] = (now + self._cache_ttl, data)
        return data

    async def related(self, shikimori_id: str | int) -> list[dict[str, Any]]:
        """Fetch related anime entries (sequel/prequel/movie/special/etc.).

        The Shikimori `/animes/:id/related` endpoint returns entries shaped as
        ``{relation, relation_russian, anime, manga}``. We keep only items
        where ``anime`` is non-null and pass the rest through unchanged.
        """
        sid = str(shikimori_id).strip()
        if not sid:
            return []
        cache_key = f"related::{sid}"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        try:
            r = await self._http.get(f"{_BASE_URL}/animes/{sid}/related")
            r.raise_for_status()
            data = r.json()
        except Exception as exc:  # noqa: BLE001
            logger.info("shikimori related failed for %s: %s", sid, exc)
            return []

        if not isinstance(data, list):
            return []
        clean = [d for d in data if isinstance(d, dict) and d.get("anime")]
        self._cache[cache_key] = (now + self._cache_ttl, clean)
        return clean


shikimori = ShikimoriClient()
