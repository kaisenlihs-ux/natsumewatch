"""Current-user endpoints: profile/settings, avatar/banner uploads, lists,
history, and stats. Public per-user views live in `routers/users.py`."""

from __future__ import annotations

import io
import logging
import os
import secrets
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, ImageSequence
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.anilibria import anilibria
from app.config import settings
from app.db import get_session
from app.models import LIST_STATUSES, User, UserList, WatchHistory
from app.schemas import (
    HistoryEntryIn,
    HistoryEntryOut,
    ListItemIn,
    ListItemOut,
    ListStatusCount,
    ProfileSettingsIn,
    ProfileStats,
    StatsBucket,
    UserMe,
)
from app.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/me", tags=["me"])


# ---------------------------------------------------------------------------
# Upload helpers
# ---------------------------------------------------------------------------

_AVATAR_MAX = 512  # px
_BANNER_MAX = 1920  # px


def _public_url(rel: str) -> str:
    """Convert a relative `/uploads/...` path into an absolute URL when a
    public base URL is configured (so the static frontend hosted on a different
    domain can fetch the asset)."""
    base = settings.public_base_url.strip().rstrip("/")
    if base:
        return f"{base}{rel}"
    return rel


def _ensure_dir(*parts: str) -> str:
    path = os.path.join(settings.uploads_dir, *parts)
    os.makedirs(path, exist_ok=True)
    return path


async def _save_image(
    upload: UploadFile, kind: str, max_dim: int, *, user_id: int
) -> str:
    """Validate and write a user-uploaded image. Returns the public URL.

    GIFs are preserved as-is (animation kept). Static images (PNG/JPEG/WebP) are
    downscaled to ``max_dim`` on the longest side and re-encoded as JPEG for
    consistency / smaller files.
    """
    allowed = {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}
    if upload.content_type not in allowed:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported image type")
    raw = await upload.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            413, f"File too large (max {settings.max_upload_bytes // (1024 * 1024)} MB)"
        )

    target_dir = _ensure_dir(kind)
    is_gif = upload.content_type == "image/gif"
    suffix = "gif" if is_gif else "jpg"
    filename = f"{user_id}_{secrets.token_hex(6)}.{suffix}"
    abs_path = os.path.join(target_dir, filename)

    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Invalid image: {exc}") from exc

    if is_gif:
        # Re-encode keeping animation; clamp dimensions.
        frames: list[Image.Image] = []
        durations: list[int] = []
        for frame in ImageSequence.Iterator(img):
            f = frame.convert("RGBA")
            f.thumbnail((max_dim, max_dim))
            frames.append(f)
            durations.append(int(frame.info.get("duration", 80)))
        if not frames:
            raise HTTPException(400, "Empty GIF")
        loop = img.info.get("loop", 0)
        frames[0].save(
            abs_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=loop,
            disposal=2,
            optimize=False,
        )
    else:
        img = img.convert("RGB")
        img.thumbnail((max_dim, max_dim))
        img.save(abs_path, "JPEG", quality=88, optimize=True, progressive=True)

    rel_url = f"/uploads/{kind}/{filename}"
    return _public_url(rel_url)


def _delete_local_upload(url: str | None) -> None:
    if not url:
        return
    # Strip any public base url prefix.
    base = settings.public_base_url.strip().rstrip("/")
    if base and url.startswith(base):
        url = url[len(base):]
    if not url.startswith("/uploads/"):
        return
    local = os.path.join(settings.uploads_dir, url[len("/uploads/") :])
    try:
        if os.path.isfile(local):
            os.remove(local)
    except OSError:  # noqa: PERF203
        pass


# ---------------------------------------------------------------------------
# Profile / settings
# ---------------------------------------------------------------------------


@router.get("", response_model=UserMe)
async def me(user: User = Depends(get_current_user)) -> UserMe:
    return UserMe.model_validate(user)


@router.patch("", response_model=UserMe)
async def update_settings(
    payload: ProfileSettingsIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMe:
    if payload.bio is not None:
        user.bio = payload.bio.strip() or None
    if payload.history_enabled is not None:
        user.history_enabled = payload.history_enabled
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserMe.model_validate(user)


@router.post("/avatar", response_model=UserMe)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMe:
    new_url = await _save_image(file, "avatars", _AVATAR_MAX, user_id=user.id)
    old = user.avatar_url
    user.avatar_url = new_url
    session.add(user)
    await session.commit()
    await session.refresh(user)
    if old and old != new_url:
        _delete_local_upload(old)
    return UserMe.model_validate(user)


@router.delete("/avatar", response_model=UserMe)
async def remove_avatar(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMe:
    old = user.avatar_url
    user.avatar_url = None
    session.add(user)
    await session.commit()
    await session.refresh(user)
    _delete_local_upload(old)
    return UserMe.model_validate(user)


@router.post("/banner", response_model=UserMe)
async def upload_banner(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMe:
    new_url = await _save_image(file, "banners", _BANNER_MAX, user_id=user.id)
    old = user.banner_url
    user.banner_url = new_url
    session.add(user)
    await session.commit()
    await session.refresh(user)
    if old and old != new_url:
        _delete_local_upload(old)
    return UserMe.model_validate(user)


@router.delete("/banner", response_model=UserMe)
async def remove_banner(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMe:
    old = user.banner_url
    user.banner_url = None
    session.add(user)
    await session.commit()
    await session.refresh(user)
    _delete_local_upload(old)
    return UserMe.model_validate(user)


# ---------------------------------------------------------------------------
# Lists
# ---------------------------------------------------------------------------


def _release_snapshot(rel: dict[str, Any]) -> dict[str, Any]:
    name = rel.get("name") or {}
    poster = rel.get("poster") or {}
    return {
        "release_alias": rel.get("alias"),
        "release_title": name.get("main"),
        "release_title_en": name.get("english"),
        "release_year": rel.get("year"),
        "release_type": (rel.get("type") or {}).get("description")
        if isinstance(rel.get("type"), dict)
        else None,
        "release_genres": [g.get("name") for g in (rel.get("genres") or []) if g.get("name")],
        "release_poster": poster.get("src") or poster.get("preview"),
        "release_episodes_total": rel.get("episodes_total"),
    }


@router.put("/lists", response_model=ListItemOut)
async def upsert_list_item(
    payload: ListItemIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ListItemOut:
    if payload.status not in LIST_STATUSES:
        raise HTTPException(400, "Invalid status")

    # 'favorite' is additive (lives alongside any other status).
    # All other statuses are mutually exclusive — we move the row.
    if payload.status != "favorite":
        existing_other = (
            await session.execute(
                select(UserList).where(
                    UserList.user_id == user.id,
                    UserList.release_id == payload.release_id,
                    UserList.status != "favorite",
                )
            )
        ).scalars().all()
        for row in existing_other:
            if row.status != payload.status:
                await session.delete(row)
        await session.flush()

    existing = (
        await session.execute(
            select(UserList).where(
                UserList.user_id == user.id,
                UserList.release_id == payload.release_id,
                UserList.status == payload.status,
            )
        )
    ).scalar_one_or_none()

    if existing:
        if payload.note is not None:
            existing.note = payload.note
        await session.commit()
        await session.refresh(existing)
        return ListItemOut.model_validate(existing)

    # New row — fetch a fresh snapshot from AniLibria.
    try:
        rel = await anilibria.release(payload.release_id)
    except RuntimeError:
        rel = {}
    snap = _release_snapshot(rel) if rel else {}

    item = UserList(
        user_id=user.id,
        release_id=payload.release_id,
        status=payload.status,
        note=payload.note,
        **snap,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return ListItemOut.model_validate(item)


@router.delete("/lists", status_code=204)
async def remove_from_list(
    release_id: int,
    status_value: str = "",
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Remove from one specific status, or all statuses if status is omitted."""
    stmt = delete(UserList).where(
        UserList.user_id == user.id, UserList.release_id == release_id
    )
    if status_value:
        if status_value not in LIST_STATUSES:
            raise HTTPException(400, "Invalid status")
        stmt = stmt.where(UserList.status == status_value)
    await session.execute(stmt)
    await session.commit()


@router.get("/lists", response_model=list[ListItemOut])
async def my_lists(
    status_value: str | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ListItemOut]:
    stmt = select(UserList).where(UserList.user_id == user.id).order_by(desc(UserList.updated_at))
    if status_value:
        if status_value not in LIST_STATUSES:
            raise HTTPException(400, "Invalid status")
        stmt = stmt.where(UserList.status == status_value)
    rows = (await session.execute(stmt)).scalars().all()
    return [ListItemOut.model_validate(r) for r in rows]


@router.get("/lists/counts", response_model=list[ListStatusCount])
async def my_list_counts(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ListStatusCount]:
    rows = await session.execute(
        select(UserList.status, func.count(UserList.id))
        .where(UserList.user_id == user.id)
        .group_by(UserList.status)
    )
    counts = {s: 0 for s in LIST_STATUSES}
    for status_value, count in rows.all():
        counts[status_value] = int(count)
    return [ListStatusCount(status=s, count=c) for s, c in counts.items()]


@router.get("/lists/by-release/{release_id}", response_model=list[str])
async def my_statuses_for_release(
    release_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    rows = await session.execute(
        select(UserList.status).where(
            UserList.user_id == user.id, UserList.release_id == release_id
        )
    )
    return [r for (r,) in rows.all()]


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


@router.post("/history", response_model=HistoryEntryOut | None)
async def record_history(
    payload: HistoryEntryIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> HistoryEntryOut | None:
    if not user.history_enabled:
        return None

    # De-duplicate: skip if the user just recorded the same episode within 60s.
    recent = (
        await session.execute(
            select(WatchHistory)
            .where(
                WatchHistory.user_id == user.id,
                WatchHistory.release_id == payload.release_id,
                WatchHistory.episode_ordinal == payload.episode_ordinal,
                WatchHistory.source_studio == payload.source_studio,
            )
            .order_by(desc(WatchHistory.watched_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if recent and recent.watched_at:
        delta = datetime.utcnow() - recent.watched_at
        if delta < timedelta(seconds=60):
            return HistoryEntryOut.model_validate(recent)

    try:
        rel = await anilibria.release(payload.release_id)
    except RuntimeError:
        rel = {}
    name = rel.get("name") or {}
    poster = rel.get("poster") or {}

    entry = WatchHistory(
        user_id=user.id,
        release_id=payload.release_id,
        release_alias=rel.get("alias"),
        release_title=name.get("main"),
        release_poster=poster.get("src") or poster.get("preview"),
        episode_ordinal=payload.episode_ordinal,
        episode_name=payload.episode_name,
        source_provider=payload.source_provider,
        source_studio=payload.source_studio,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return HistoryEntryOut.model_validate(entry)


@router.get("/history", response_model=list[HistoryEntryOut])
async def list_history(
    limit: int = 100,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[HistoryEntryOut]:
    rows = (
        await session.execute(
            select(WatchHistory)
            .where(WatchHistory.user_id == user.id)
            .order_by(desc(WatchHistory.watched_at))
            .limit(min(max(limit, 1), 500))
        )
    ).scalars().all()
    return [HistoryEntryOut.model_validate(r) for r in rows]


@router.delete("/history", status_code=204)
async def clear_history(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    await session.execute(delete(WatchHistory).where(WatchHistory.user_id == user.id))
    await session.commit()


@router.delete("/history/{entry_id}", status_code=204)
async def delete_history_entry(
    entry_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    await session.execute(
        delete(WatchHistory).where(
            WatchHistory.id == entry_id, WatchHistory.user_id == user.id
        )
    )
    await session.commit()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=ProfileStats)
async def profile_stats(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileStats:
    rows = (
        await session.execute(select(UserList).where(UserList.user_id == user.id))
    ).scalars().all()

    counts = {s: 0 for s in LIST_STATUSES}
    for r in rows:
        counts[r.status] = counts.get(r.status, 0) + 1

    # Aggregate over watched + watching (most representative of taste).
    interest = [r for r in rows if r.status in ("watched", "watching", "favorite")]
    genres: Counter[str] = Counter()
    types: Counter[str] = Counter()
    years: Counter[int] = Counter()
    for r in interest:
        for g in r.release_genres or []:
            genres[g] += 1
        if r.release_type:
            types[r.release_type] += 1
        if r.release_year:
            years[r.release_year] += 1

    return ProfileStats(
        total_watched=counts["watched"],
        total_watching=counts["watching"],
        total_planned=counts["planned"],
        total_postponed=counts["postponed"],
        total_dropped=counts["dropped"],
        total_favorite=counts["favorite"],
        by_genre=[StatsBucket(label=k, count=v) for k, v in genres.most_common(12)],
        by_type=[StatsBucket(label=k, count=v) for k, v in types.most_common()],
        by_year=[StatsBucket(label=str(k), count=v) for k, v in sorted(years.items())],
    )


# ---------------------------------------------------------------------------
# Online presence (per-user heartbeat). The anonymous /api/stats/heartbeat
# remains for the global online counter; this endpoint persists `last_seen_at`
# on the user row so other users can see online indicators on profiles.
# ---------------------------------------------------------------------------


@router.post("/heartbeat", response_model=UserMe)
async def user_heartbeat(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMe:
    user.last_seen_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserMe.model_validate(user)
