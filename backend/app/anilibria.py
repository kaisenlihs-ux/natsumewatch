"""Thin async client over the AniLibria public API (https://anilibria.top/api/v1)."""

import asyncio
import time
from typing import Any

import httpx

from app.config import settings


class AniLibriaClient:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = 60  # seconds

    async def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=settings.anilibria_base_url,
                timeout=httpx.Timeout(15.0),
                headers={"User-Agent": "NatsumeWatch/1.0 (+https://natsumewatch.app)"},
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _cache_key(self, path: str, params: dict[str, Any] | None) -> str:
        return f"{path}?{sorted((params or {}).items())}"

    async def _get(
        self, path: str, params: dict[str, Any] | None = None, *, cache: bool = True
    ) -> Any:
        key = self._cache_key(path, params)
        now = time.time()
        if cache and key in self._cache:
            ts, val = self._cache[key]
            if now - ts < self._cache_ttl:
                return val
        c = await self.client()
        for attempt in range(3):
            try:
                r = await c.get(path, params=params)
                r.raise_for_status()
                data = r.json()
                if cache:
                    self._cache[key] = (now, data)
                return data
            except (httpx.HTTPError, ValueError) as exc:
                if attempt == 2:
                    raise RuntimeError(f"AniLibria upstream failed: {exc}") from exc
                await asyncio.sleep(0.5 * (attempt + 1))

    # ---------- Releases ----------
    async def latest(self, limit: int = 16) -> list[dict[str, Any]]:
        return await self._get("/anime/releases/latest", {"limit": limit})

    async def random(self, limit: int = 1) -> list[dict[str, Any]]:
        return await self._get("/anime/releases/random", {"limit": limit}, cache=False)

    async def release(self, id_or_alias: str | int) -> dict[str, Any]:
        return await self._get(f"/anime/releases/{id_or_alias}")

    # ---------- Catalog & search ----------
    async def catalog(
        self,
        *,
        page: int = 1,
        limit: int = 24,
        genres: list[int] | None = None,
        types: list[str] | None = None,
        seasons: list[str] | None = None,
        from_year: int | None = None,
        to_year: int | None = None,
        age_ratings: list[str] | None = None,
        publish_statuses: list[str] | None = None,
        production_statuses: list[str] | None = None,
        sorting: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        params: list[tuple[str, Any]] = [("page", page), ("limit", limit)]
        if genres:
            for g in genres:
                params.append(("f[genres][]", g))
        if types:
            for t in types:
                params.append(("f[types][]", t))
        if seasons:
            for s in seasons:
                params.append(("f[seasons][]", s))
        if age_ratings:
            for a in age_ratings:
                params.append(("f[age_ratings][]", a))
        if publish_statuses:
            for p in publish_statuses:
                params.append(("f[publish_statuses][]", p))
        if production_statuses:
            for p in production_statuses:
                params.append(("f[production_statuses][]", p))
        if from_year is not None:
            params.append(("f[years][from_year]", from_year))
        if to_year is not None:
            params.append(("f[years][to_year]", to_year))
        if sorting:
            params.append(("f[sorting]", sorting))
        if search:
            params.append(("f[search]", search))
        return await self._get("/anime/catalog/releases", dict(params))

    async def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        if not query.strip():
            return []
        return await self._get(
            "/app/search/releases",
            {"query": query, "limit": limit},
            cache=False,
        )

    # ---------- References ----------
    async def reference(self, name: str) -> Any:
        return await self._get(f"/anime/catalog/references/{name}")


anilibria = AniLibriaClient()
