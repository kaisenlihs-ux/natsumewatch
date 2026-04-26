from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.anilibria import anilibria
from app.kodik import kodik

router = APIRouter(prefix="/api/anime", tags=["anime"])


@router.get("/latest")
async def latest(limit: int = Query(16, ge=1, le=50)) -> list[dict[str, Any]]:
    return await anilibria.latest(limit=limit)


@router.get("/random")
async def random(limit: int = Query(1, ge=1, le=10)) -> list[dict[str, Any]]:
    return await anilibria.random(limit=limit)


@router.get("/featured")
async def featured() -> list[dict[str, Any]]:
    """A small curated set of recent ongoings used for the home hero carousel."""
    items = await anilibria.latest(limit=24)
    ongoing = [it for it in items if it.get("is_ongoing")]
    return (ongoing or items)[:6]


@router.get("/search")
async def search(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=50)) -> list:
    return await anilibria.search(q, limit=limit)


@router.get("/catalog")
async def catalog(
    page: int = 1,
    limit: int = Query(24, ge=1, le=50),
    genres: list[int] | None = Query(None),
    types: list[str] | None = Query(None),
    seasons: list[str] | None = Query(None),
    from_year: int | None = None,
    to_year: int | None = None,
    age_ratings: list[str] | None = Query(None),
    publish_statuses: list[str] | None = Query(None),
    production_statuses: list[str] | None = Query(None),
    sorting: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    return await anilibria.catalog(
        page=page,
        limit=limit,
        genres=genres,
        types=types,
        seasons=seasons,
        from_year=from_year,
        to_year=to_year,
        age_ratings=age_ratings,
        publish_statuses=publish_statuses,
        production_statuses=production_statuses,
        sorting=sorting,
        search=search,
    )


@router.get("/references")
async def references() -> dict[str, Any]:
    """Bulk fetch of all reference lists used by filters."""
    names = [
        "genres",
        "years",
        "types",
        "age-ratings",
        "publish-statuses",
        "production-statuses",
        "seasons",
        "sorting",
    ]
    out: dict[str, Any] = {}
    for n in names:
        try:
            out[n.replace("-", "_")] = await anilibria.reference(n)
        except Exception:
            out[n.replace("-", "_")] = []
    return out


@router.get("/{id_or_alias}")
async def release(id_or_alias: str) -> dict[str, Any]:
    try:
        return await anilibria.release(id_or_alias)
    except RuntimeError as exc:
        raise HTTPException(404, str(exc)) from exc


def _ensure_https(link: str) -> str:
    if not link:
        return ""
    if link.startswith("//"):
        return "https:" + link
    if link.startswith("http://"):
        return "https://" + link[len("http://") :]
    return link


def _kodik_studio(item: dict[str, Any]) -> str:
    tr = item.get("translation") or {}
    title = tr.get("title")
    if title:
        return str(title)
    studio = item.get("translation_title") or item.get("studio")
    return str(studio or "Озвучка")


def _kodik_language(item: dict[str, Any]) -> str:
    """Best-effort language detection from translation metadata.

    For subtitles entries we always return "ja" — Kodik subtitle releases ship
    the original Japanese audio with one of EN/RU subtitle tracks baked in.
    """
    tr = item.get("translation") or {}
    typ = tr.get("type") or item.get("translation_type") or ""
    title = (tr.get("title") or "").lower()
    if "subtitles" in str(typ):
        return "ja"
    if any(k in title for k in ("eng", "english", "англ")):
        return "en"
    if any(k in title for k in ("jpn", "japan", "японск", "ориг", "raw")):
        return "ja"
    return "ru"


def _kodik_episodes(
    item: dict[str, Any],
) -> list[dict[str, Any]]:
    """Normalize episodes for both serial and movie shapes."""
    seasons = item.get("seasons") or {}
    out: list[dict[str, Any]] = []
    if seasons:
        # Pick first season; Kodik often groups all under "1".
        season_key = next(iter(seasons))
        season = seasons[season_key]
        episodes = season.get("episodes") or {}
        for ord_key in sorted(episodes.keys(), key=lambda k: float(k) if str(k).replace(".", "").isdigit() else 0):
            entry = episodes[ord_key]
            link = entry.get("link") if isinstance(entry, dict) else entry
            try:
                ordinal = float(ord_key)
                ordinal_int = int(ordinal) if ordinal.is_integer() else None
            except (ValueError, TypeError):
                ordinal_int = None
            out.append(
                {
                    "ordinal": ordinal_int if ordinal_int is not None else ord_key,
                    "iframe": _ensure_https(link or ""),
                }
            )
        return out
    link = item.get("link")
    if link:
        out.append({"ordinal": 1, "iframe": _ensure_https(link)})
    return out


@router.get("/{id_or_alias}/dubs")
async def dubs(id_or_alias: str) -> dict[str, Any]:
    """Aggregate available voice-over options across AniLibria and Kodik."""
    try:
        rel = await anilibria.release(id_or_alias)
    except RuntimeError as exc:
        raise HTTPException(404, str(exc)) from exc

    # 1) Native AniLibria source (if episodes exist with HLS).
    sources: list[dict[str, Any]] = []
    al_episodes = rel.get("episodes") or []
    if al_episodes:
        eps_norm = []
        for ep in al_episodes:
            eps_norm.append(
                {
                    "ordinal": ep.get("ordinal"),
                    "name": ep.get("name"),
                    "duration": ep.get("duration"),
                    "preview": ep.get("preview"),
                    "hls_480": ep.get("hls_480"),
                    "hls_720": ep.get("hls_720"),
                    "hls_1080": ep.get("hls_1080"),
                }
            )
        sources.append(
            {
                "provider": "anilibria",
                "studio": "AniLibria",
                "language": "ru",
                "kind": "voice",
                "episodes_count": len(eps_norm),
                "episodes": eps_norm,
            }
        )

    # 2) Kodik aggregator (multiple dubs, subtitles, sometimes EN/JP).
    name = rel.get("name") or {}
    en_title = name.get("english")
    main_title = name.get("main")
    year = rel.get("year")
    items: list[dict[str, Any]] = []
    if en_title:
        items = await kodik.search(title=en_title, year=year, with_episodes=True)
    if not items and main_title:
        items = await kodik.search(title=main_title, year=year, with_episodes=True)

    seen: set[str] = set()
    for item in items:
        episodes = _kodik_episodes(item)
        if not episodes:
            continue
        studio = _kodik_studio(item)
        lang = _kodik_language(item)
        kind = (
            "subtitles"
            if "subtitles" in str((item.get("translation") or {}).get("type", ""))
            else "voice"
        )
        dedup_key = f"{studio}::{lang}::{kind}::{len(episodes)}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        sources.append(
            {
                "provider": "kodik",
                "studio": studio,
                "language": lang,
                "kind": kind,
                "quality": item.get("quality"),
                "episodes_count": len(episodes),
                "episodes": episodes,
            }
        )

    return {
        "release_id": rel.get("id"),
        "alias": rel.get("alias"),
        "title": main_title,
        "title_en": en_title,
        "year": year,
        "sources": sources,
    }
