from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.anilibria import anilibria
from app.jikan import jikan
from app.kodik import kodik, kodik_to_release_shape

router = APIRouter(prefix="/api/anime", tags=["anime"])

_EXT_PREFIX = "ext-shiki-"


def _is_ext_alias(id_or_alias: str) -> bool:
    return str(id_or_alias).startswith(_EXT_PREFIX)


def _ext_shikimori(id_or_alias: str) -> str:
    return str(id_or_alias)[len(_EXT_PREFIX):]


async def _load_release(id_or_alias: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Resolve a release by AniLibria id/alias or our synthesized ext-shiki-* alias.

    Returns (release_dict, kodik_items). For AniLibria releases the kodik items
    are deferred (empty list) so callers that don't need them avoid a Kodik
    round-trip; the dubs/meta/ratings endpoints fetch Kodik separately as
    needed. For ext aliases the Kodik items list is the source of truth and is
    populated up-front."""
    if _is_ext_alias(id_or_alias):
        shiki = _ext_shikimori(id_or_alias)
        items = await kodik.search_by_shikimori(shiki, with_episodes=True)
        if not items:
            raise HTTPException(404, f"External title {id_or_alias!r} not found in Kodik")
        rel = kodik_to_release_shape(items[0])
        if rel is None:
            raise HTTPException(404, "Kodik item missing shikimori_id")
        return rel, items
    try:
        rel = await anilibria.release(id_or_alias)
    except RuntimeError as exc:
        raise HTTPException(404, str(exc)) from exc
    return rel, []


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
async def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    include_external: bool = Query(True),
) -> list:
    """Search by title.

    AniLibria is queried first. When ``include_external`` is true (default), we
    also query Kodik and append titles missing from the AniLibria result by a
    normalized title comparison. Kodik items are returned in the same shape as
    AniLibria releases with the synthesized ``ext-shiki-<id>`` alias so the
    detail page knows how to load them."""
    al_items: list[dict[str, Any]] = []
    try:
        al_items = await anilibria.search(q, limit=limit)
    except RuntimeError:
        al_items = []
    if not include_external:
        return al_items

    al_titles = set()
    for item in al_items:
        n = item.get("name") or {}
        for k in ("main", "english", "alternative"):
            t = _norm_text(n.get(k))
            if t:
                al_titles.add(t)

    try:
        kodik_items = await kodik.search(title=q, with_episodes=False, limit=20)
    except Exception:  # noqa: BLE001
        kodik_items = []

    out = list(al_items)
    seen_shiki: set[str] = set()
    for kitem in kodik_items:
        if _is_red_tail_dorama(kitem):
            continue
        rel = kodik_to_release_shape(kitem)
        if rel is None:
            continue
        shiki = rel["external_shikimori_id"]
        if shiki in seen_shiki:
            continue
        seen_shiki.add(shiki)
        # Drop if AniLibria already has a result with the same title.
        rel_titles = {
            _norm_text((rel.get("name") or {}).get("main")),
            _norm_text((rel.get("name") or {}).get("english")),
            _norm_text((rel.get("name") or {}).get("alternative")),
        }
        rel_titles.discard("")
        if rel_titles & al_titles:
            continue
        out.append(rel)
        if len(out) >= limit + 10:  # cap external results to avoid spam
            break
    return out


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
    rel, _ = await _load_release(id_or_alias)
    return rel


@router.get("/{id_or_alias}/torrents")
async def release_torrents(id_or_alias: str) -> dict[str, Any]:
    """Normalized torrent list straight from AniLibria (1080p/720p/480p with
    magnet + .torrent download links + episode range). Returns an empty list
    for external (Kodik-only) titles."""
    from app.config import settings

    if _is_ext_alias(id_or_alias):
        return {"release_id": id_or_alias, "alias": id_or_alias, "torrents": []}
    try:
        rel = await anilibria.release(id_or_alias)
    except RuntimeError as exc:
        raise HTTPException(404, str(exc)) from exc

    torrents = rel.get("torrents") or []
    out = []
    for t in torrents:
        tid = t.get("id")
        out.append(
            {
                "id": tid,
                "label": t.get("label"),
                "quality": (t.get("quality") or {}).get("value"),
                "type": (t.get("type") or {}).get("description")
                or (t.get("type") or {}).get("value"),
                "codec": (t.get("codec") or {}).get("description"),
                "size": t.get("size"),
                "seeders": t.get("seeders"),
                "leechers": t.get("leechers"),
                "completed_times": t.get("completed_times"),
                "magnet": t.get("magnet"),
                "filename": t.get("filename"),
                "episodes": t.get("description"),
                "updated_at": t.get("updated_at"),
                "download_url": (
                    f"{settings.anilibria_base_url}/anime/torrents/{tid}/file" if tid else None
                ),
                "is_hardsub": t.get("is_hardsub"),
            }
        )
    return {
        "release_id": rel.get("id"),
        "alias": rel.get("alias"),
        "torrents": out,
    }


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


def _norm_text(text: str | None) -> str:
    if not text:
        return ""
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in text).split())


def _kodik_matches_release(item: dict[str, Any], rel: dict[str, Any]) -> bool:
    name = rel.get("name") or {}
    targets = {
        _norm_text(name.get("main")),
        _norm_text(name.get("english")),
        _norm_text(name.get("alternative")),
    }
    targets.discard("")
    if not targets:
        return True

    md = item.get("material_data") or {}
    candidates = {
        _norm_text(item.get("title")),
        _norm_text(item.get("title_orig")),
        _norm_text(item.get("other_title")),
        _norm_text(md.get("title")),
        _norm_text(md.get("title_en")),
        _norm_text(md.get("anime_title")),
    }
    candidates.discard("")
    if not candidates:
        return False
    for cand in candidates:
        for target in targets:
            if cand == target or cand in target or target in cand:
                return True
    return False


def _is_red_tail_dorama(item: dict[str, Any]) -> bool:
    studio = _kodik_studio(item).lower()
    item_type = str(item.get("type") or "").lower()
    if "red tail" not in studio:
        return False
    return "foreign" in item_type or "dorama" in item_type


def _kodik_source_rank(item: dict[str, Any]) -> tuple[int, int, int]:
    studio = _kodik_studio(item).lower()
    tr = item.get("translation") or {}
    kind = 1 if "subtitles" in str(tr.get("type") or "") else 0
    quality = str(item.get("quality") or "")
    quality_score = 0
    if "1080" in quality:
        quality_score = 3
    elif "720" in quality:
        quality_score = 2
    elif "480" in quality:
        quality_score = 1
    studio_score = 0
    if "anilibria" in studio or "aniliberty" in studio:
        studio_score = 2
    elif "crunchyroll" in studio:
        studio_score = 1
    return (kind, quality_score, studio_score)


def _extract_external_ratings(
    rel: dict[str, Any], kodik_items: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if rel.get("external_provider") != "kodik":
        out.append(
            {
                "source": "AniLibria",
                "value": (rel.get("age_rating") or {}).get("label"),
                "votes": None,
                "url": f"https://anilibria.top/anime/releases/release/{rel.get('alias')}",
                "kind": "label",
            }
        )

    first = kodik_items[0] if kodik_items else {}
    md = (first.get("material_data") if isinstance(first, dict) else None) or {}
    shiki = md.get("shikimori_rating")
    shiki_votes = md.get("shikimori_votes")
    shiki_id = first.get("shikimori_id") if isinstance(first, dict) else None
    if shiki is not None:
        out.append(
            {
                "source": "Shikimori",
                "value": shiki,
                "votes": shiki_votes,
                "url": f"https://shikimori.one/animes/{shiki_id}" if shiki_id else None,
                "kind": "score",
            }
        )
    imdb = md.get("imdb_rating")
    imdb_votes = md.get("imdb_votes")
    imdb_id = first.get("imdb_id") if isinstance(first, dict) else None
    if imdb is not None or imdb_id:
        out.append(
            {
                "source": "IMDb",
                "value": imdb,
                "votes": imdb_votes,
                "url": f"https://www.imdb.com/title/{imdb_id}/" if imdb_id else None,
                "kind": "score" if imdb is not None else "link",
            }
        )
    kp = md.get("kinopoisk_rating")
    kp_votes = md.get("kinopoisk_votes")
    kp_id = first.get("kinopoisk_id") if isinstance(first, dict) else None
    if kp is not None or kp_id:
        out.append(
            {
                "source": "Кинопоиск",
                "value": kp,
                "votes": kp_votes,
                "url": f"https://www.kinopoisk.ru/series/{kp_id}/" if kp_id else None,
                "kind": "score" if kp is not None else "link",
            }
        )
    return out


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
        def _ord_key(k: str) -> float:
            return float(k) if str(k).replace(".", "").isdigit() else 0.0

        for ord_key in sorted(episodes.keys(), key=_ord_key):
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


@router.get("/{id_or_alias}/ratings")
async def release_ratings(id_or_alias: str) -> dict[str, Any]:
    rel, ext_items = await _load_release(id_or_alias)

    name = rel.get("name") or {}
    year = rel.get("year")
    en_title = name.get("english")
    main_title = name.get("main")
    if ext_items:
        items = ext_items
    else:
        items = []
        if en_title:
            items = await kodik.search(title=en_title, year=year, with_episodes=False)
        if not items and main_title:
            items = await kodik.search(title=main_title, year=year, with_episodes=False)
        items = [item for item in items if _kodik_matches_release(item, rel)]

    ratings = _extract_external_ratings(rel, items)
    jikan_item = await jikan.search_best(
        title=en_title or main_title,
        year=year,
        alt_titles=[main_title, name.get("alternative")],
    )
    if jikan_item and jikan_item.get("score") is not None:
        ratings.append(
            {
                "source": "MyAnimeList",
                "value": jikan_item.get("score"),
                "votes": jikan_item.get("scored_by"),
                "url": f"https://myanimelist.net/anime/{jikan_item.get('mal_id')}",
                "kind": "score",
            }
        )

    return {
        "release_id": rel.get("id"),
        "alias": rel.get("alias"),
        "ratings": ratings,
    }


_SOURCE_LABELS_RU = {
    "manga": "Манга",
    "light novel": "Ранобэ",
    "web manga": "Веб-манга",
    "novel": "Новелла",
    "web novel": "Веб-новелла",
    "visual novel": "Визуальная новелла",
    "original": "Оригинал",
    "game": "Игра",
    "card game": "Карточная игра",
    "music": "Музыка",
    "picture book": "Книга с картинками",
    "4-koma manga": "4-кома манга",
    "book": "Книга",
    "radio": "Радио",
    "other": "Другое",
    "mixed media": "Смешанные источники",
}


def _ru_source_label(source: str | None) -> str | None:
    if not source:
        return None
    key = source.strip().lower()
    return _SOURCE_LABELS_RU.get(key) or source


@router.get("/{id_or_alias}/meta")
async def release_meta(id_or_alias: str) -> dict[str, Any]:
    rel, ext_items = await _load_release(id_or_alias)

    name = rel.get("name") or {}
    en_title = name.get("english")
    main_title = name.get("main")
    year = rel.get("year")

    jikan_item = await jikan.search_best(
        title=en_title or main_title,
        year=year,
        alt_titles=[main_title, name.get("alternative")],
    )

    studios: list[str] = []
    director: str | None = None
    source_raw: str | None = None
    title_japanese: str | None = None
    title_romaji: str | None = None
    mal_id: int | None = None

    if jikan_item:
        mal_id = jikan_item.get("mal_id")
        title_japanese = jikan_item.get("title_japanese")
        title_romaji = jikan_item.get("title")
        source_raw = jikan_item.get("source")
        for st in jikan_item.get("studios") or []:
            label = st.get("name") if isinstance(st, dict) else None
            if label:
                studios.append(str(label))
        if mal_id:
            director = await jikan.director(mal_id)

    if not studios:
        # Fallback to Kodik material_data anime_studios when Jikan is silent.
        if ext_items:
            items = ext_items
        else:
            items = []
            if en_title:
                items = await kodik.search(title=en_title, year=year, with_episodes=False)
            if not items and main_title:
                items = await kodik.search(title=main_title, year=year, with_episodes=False)
            items = [it for it in items if _kodik_matches_release(it, rel)]
        for it in items:
            md = it.get("material_data") or {}
            for label in md.get("anime_studios") or []:
                if label and label not in studios:
                    studios.append(str(label))
            if not source_raw and md.get("source"):
                source_raw = str(md.get("source"))
            if studios:
                break

    return {
        "release_id": rel.get("id"),
        "alias": rel.get("alias"),
        "title_japanese": title_japanese,
        "title_japanese_romaji": title_romaji,
        "title_english": en_title,
        "studios": studios,
        "director": director,
        "source": source_raw,
        "source_label": _ru_source_label(source_raw),
        "mal_id": mal_id,
    }


@router.get("/{id_or_alias}/dubs")
async def dubs(id_or_alias: str) -> dict[str, Any]:
    """Aggregate available voice-over options across AniLibria and Kodik."""
    rel, ext_items = await _load_release(id_or_alias)

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
    if ext_items:
        items = ext_items
        skip_match_check = True
    else:
        items = []
        if en_title:
            items = await kodik.search(title=en_title, year=year, with_episodes=True)
        if not items and main_title:
            items = await kodik.search(title=main_title, year=year, with_episodes=True)
        skip_match_check = False

    grouped: dict[tuple[str, str, str], dict[str, Any]] = {}
    for item in items:
        if not skip_match_check and not _kodik_matches_release(item, rel):
            continue
        if _is_red_tail_dorama(item):
            continue
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
        dedup_key = (studio.lower(), lang, kind)
        existing = grouped.get(dedup_key)
        candidate = {
            "provider": "kodik",
            "studio": studio,
            "language": lang,
            "kind": kind,
            "quality": item.get("quality"),
            "episodes_count": len(episodes),
            "episodes": episodes,
            "_rank": _kodik_source_rank(item),
        }
        if existing is None:
            grouped[dedup_key] = candidate
            continue
        if candidate["episodes_count"] > existing["episodes_count"] or (
            candidate["episodes_count"] == existing["episodes_count"]
            and candidate["_rank"] > existing["_rank"]
        ):
            grouped[dedup_key] = candidate

    kodik_sources = list(grouped.values())
    kodik_sources.sort(
        key=lambda s: (
            {"ru": 0, "ja": 1, "en": 2}.get(s["language"], 9),
            s["kind"] == "subtitles",
            s["studio"].lower(),
        )
    )
    for item in kodik_sources:
        item.pop("_rank", None)
        sources.append(item)

    return {
        "release_id": rel.get("id"),
        "alias": rel.get("alias"),
        "title": main_title,
        "title_en": en_title,
        "year": year,
        "sources": sources,
    }
