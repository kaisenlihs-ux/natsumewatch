from __future__ import annotations

import time
from typing import Any

import httpx

_BASE_URL = "https://api.jikan.moe/v4"


def _norm(text: str | None) -> str:
    if not text:
        return ""
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in text).split())


class JikanClient:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=15.0, headers={"User-Agent": "NatsumeWatch/1.0"})
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = 60 * 60 * 6

    async def close(self) -> None:
        await self._http.aclose()

    async def search_best(
        self,
        *,
        title: str | None,
        year: int | None = None,
        alt_titles: list[str] | None = None,
    ) -> dict[str, Any] | None:
        query = (title or "").strip()
        if not query:
            return None
        cache_key = f"search::{query}::{year}::{tuple(alt_titles or [])}"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        try:
            res = await self._http.get(f"{_BASE_URL}/anime", params={"q": query, "limit": 8})
            res.raise_for_status()
            data = res.json().get("data", [])
        except Exception:
            return None

        targets = {_norm(query)}
        for alt in alt_titles or []:
            if alt:
                targets.add(_norm(alt))

        best: tuple[int, dict[str, Any] | None] = (-1, None)
        for item in data:
            candidates = {
                _norm(item.get("title")),
                _norm(item.get("title_english")),
                _norm(item.get("title_japanese")),
            }
            for syn in item.get("titles", []):
                if isinstance(syn, dict):
                    candidates.add(_norm(syn.get("title")))
            score = 0
            if any(t and t in candidates for t in targets):
                score += 100
            for cand in list(candidates):
                for target in targets:
                    if not cand or not target:
                        continue
                    if cand in target or target in cand:
                        score += 20
            if year is not None and item.get("year") == year:
                score += 15
            if item.get("score") is not None:
                score += 5
            if score > best[0]:
                best = (score, item)

        out = best[1]
        self._cache[cache_key] = (now + self._cache_ttl, out)
        return out

    async def director(self, mal_id: int) -> str | None:
        cache_key = f"director::{mal_id}"
        now = time.time()
        cached = self._cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]
        try:
            res = await self._http.get(f"{_BASE_URL}/anime/{mal_id}/staff")
            res.raise_for_status()
            data = res.json().get("data", [])
        except Exception:
            return None
        director: str | None = None
        for entry in data:
            positions = entry.get("positions") or []
            if not any(
                "director" in str(p).lower() and "assistant" not in str(p).lower()
                for p in positions
            ):
                continue
            person = entry.get("person") or {}
            name = person.get("name")
            if name:
                director = str(name)
                break
        self._cache[cache_key] = (now + self._cache_ttl, director)
        return director


jikan = JikanClient()
