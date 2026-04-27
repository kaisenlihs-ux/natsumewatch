"""Kodik aggregator integration.

Kodik (https://kodikapi.com) is a third-party Russian anime player aggregator
that exposes voice-overs (dubs) and subtitle tracks from many studios as
embeddable iframes. We use it to extend the AniLibria-only catalog with
multiple voice-over options and original Japanese with subtitles / English
dubs (when present in the upstream catalog).

The API requires a token. Tokens are sourced (via env override) or pulled and
decrypted from the public ``YaNesyTortiK/AnimeParsers`` token feed. We cache
the first working token for the lifetime of the process and fall back to the
next one on auth failures.
"""

from __future__ import annotations

import asyncio
import logging
import time
from base64 import b64decode
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TOKENS_FEED = (
    "https://raw.githubusercontent.com/YaNesyTortiK/AnimeParsers/main/"
    "kdk_tokns/tokens.json"
)
# Kodik moved its public API domain in 2026 — old kodikapi.com is dead, the
# service is now reachable at kodik-api.com (same IP / certificate / API shape).
_BASE_URL = "https://kodik-api.com"
_PROBE_TITLE = "naruto"


def _decrypt(tkn: str) -> str:
    half = len(tkn) // 2
    p1 = b64decode(tkn[:half][::-1].encode("utf-8")).decode("utf-8")
    p2 = b64decode(tkn[half:][::-1].encode("utf-8")).decode("utf-8")
    return p2 + p1


class KodikClient:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=15.0)
        self._token: str | None = settings.kodik_token or None
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = 300.0
        self._token_lock = asyncio.Lock()

    async def close(self) -> None:
        await self._http.aclose()

    async def _ensure_token(self) -> str | None:
        if self._token:
            return self._token
        async with self._token_lock:
            if self._token:
                return self._token
            try:
                feed = await self._http.get(_TOKENS_FEED)
                feed.raise_for_status()
                data = feed.json()
            except Exception as exc:  # noqa: BLE001
                logger.warning("kodik: failed to load token feed: %s", exc)
                return None
            for bucket in ("stable", "unstable", "legacy"):
                for entry in data.get(bucket, []):
                    enc = entry.get("tokn")
                    if not enc:
                        continue
                    try:
                        cand = _decrypt(enc)
                    except Exception:  # noqa: BLE001
                        continue
                    if await self._probe(cand):
                        self._token = cand
                        logger.info("kodik: using %s token", bucket)
                        return cand
        return None

    async def _probe(self, token: str) -> bool:
        try:
            r = await self._http.get(
                f"{_BASE_URL}/search",
                params={"token": token, "title": _PROBE_TITLE, "limit": 1},
            )
        except Exception:  # noqa: BLE001
            return False
        if r.status_code != 200:
            return False
        try:
            payload = r.json()
        except Exception:  # noqa: BLE001
            return False
        return bool(payload.get("results"))

    async def _request(
        self, path: str, params: dict[str, Any]
    ) -> dict[str, Any] | None:
        token = await self._ensure_token()
        if not token:
            return None
        params = {"token": token, **params}
        try:
            r = await self._http.get(f"{_BASE_URL}{path}", params=params)
        except httpx.HTTPError as exc:
            logger.warning("kodik %s failed: %s", path, exc)
            return None
        if r.status_code == 401:
            self._token = None
            return None
        if r.status_code != 200:
            logger.info("kodik %s status %s", path, r.status_code)
            return None
        try:
            return r.json()
        except Exception:  # noqa: BLE001
            return None

    async def search(
        self,
        *,
        title: str | None = None,
        title_orig: str | None = None,
        year: int | None = None,
        with_episodes: bool = True,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        if not title and not title_orig:
            return []

        cache_key = f"search::{title}::{title_orig}::{year}::{with_episodes}::{limit}"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        params: dict[str, Any] = {
            "limit": limit,
            "with_episodes": "true" if with_episodes else "false",
            "with_material_data": "true",
        }
        if title:
            params["title"] = title
        if title_orig:
            params["title_orig"] = title_orig
        if year:
            params["year"] = year

        data = await self._request("/search", params)
        results = (data or {}).get("results", []) if isinstance(data, dict) else []
        self._cache[cache_key] = (now + self._cache_ttl, results)
        return results

    async def search_by_shikimori(
        self, shikimori_id: str | int, *, with_episodes: bool = True
    ) -> list[dict[str, Any]]:
        """Return every Kodik release/serial entry for a given shikimori_id."""
        cache_key = f"shiki::{shikimori_id}::{with_episodes}"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        params: dict[str, Any] = {
            "shikimori_id": str(shikimori_id),
            "limit": 100,
            "with_episodes": "true" if with_episodes else "false",
            "with_material_data": "true",
        }
        data = await self._request("/search", params)
        results = (data or {}).get("results", []) if isinstance(data, dict) else []
        self._cache[cache_key] = (now + self._cache_ttl, results)
        return results


def kodik_item_external_id(item: dict[str, Any]) -> str | None:
    """Stable external id we use for ext-aliases. Prefers shikimori_id."""
    for key in ("shikimori_id", "kinopoisk_id", "imdb_id", "worldart_link"):
        v = item.get(key)
        if v:
            return f"{key}:{v}"
    return None


def kodik_to_release_shape(item: dict[str, Any]) -> dict[str, Any] | None:
    """Convert a Kodik catalog item into an AniLibria-compatible release shape.

    Returns ``None`` when the item lacks an external id (we need it for the
    ``ext-<shikimori>`` alias roundtrip)."""
    md = item.get("material_data") or {}
    shiki = item.get("shikimori_id") or md.get("shikimori_id")
    if not shiki:
        return None
    title_main = (
        item.get("title")
        or md.get("title")
        or md.get("title_en")
        or item.get("title_orig")
        or "Без названия"
    )
    title_orig = item.get("title_orig") or md.get("title_japanese")
    title_en = md.get("title_en") or item.get("title")
    year = item.get("year") or md.get("year")
    poster = (
        md.get("poster_url")
        or md.get("anime_poster_url")
        or item.get("material_data", {}).get("poster_url")
        or None
    )
    description = md.get("anime_description") or md.get("description") or ""
    raw_genres = md.get("anime_genres") or md.get("genres") or []
    genres = [
        {"id": idx, "name": g, "image": None}
        for idx, g in enumerate(raw_genres)
        if g
    ]
    episodes_total = (
        md.get("episodes_total")
        or md.get("episodes_aired")
        or item.get("episodes_count")
    )
    raw_type = (md.get("anime_kind") or md.get("type") or "").lower()
    type_map = {
        "tv": ("TV", "ТВ"),
        "movie": ("MOVIE", "Фильм"),
        "ova": ("OVA", "OVA"),
        "ona": ("ONA", "ONA"),
        "special": ("SPECIAL", "Спешл"),
        "music": ("MUSIC", "Музыка"),
    }
    type_obj: dict[str, Any] | None = None
    if raw_type in type_map:
        v, d = type_map[raw_type]
        type_obj = {"value": v, "description": d}
    age_rating_label = md.get("rating_mpaa") or md.get("minimal_age")
    return {
        "id": f"ext-shiki-{shiki}",
        "alias": f"ext-shiki-{shiki}",
        "external_provider": "kodik",
        "external_shikimori_id": str(shiki),
        "name": {
            "main": title_main,
            "english": title_en if title_en and title_en != title_main else None,
            "alternative": title_orig if title_orig and title_orig != title_main else None,
        },
        "description": description,
        "year": year,
        "season": None,
        "type": type_obj,
        "age_rating": (
            {"label": str(age_rating_label)} if age_rating_label else None
        ),
        "publish_status": None,
        "production_status": None,
        "is_ongoing": (md.get("anime_status") or "").lower() == "ongoing",
        "average_duration_of_episode": md.get("duration"),
        "episodes_total": episodes_total,
        "genres": genres,
        "poster": {"src": poster} if poster else None,
        "torrents": [],
        "added_in_users_favorites": None,
        "added_in_planned_collection": None,
    }


kodik = KodikClient()
