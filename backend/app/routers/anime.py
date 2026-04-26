from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.anilibria import anilibria

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
