"""Public per-user views: profile, lists, online status."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import LIST_STATUSES, User, UserList
from app.schemas import ListItemOut, UserPublic

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: int, session: AsyncSession = Depends(get_session)) -> UserPublic:
    u = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    return UserPublic.model_validate(u)


@router.get("/{user_id}/online")
async def is_online(user_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    u = (
        await session.execute(select(User.last_seen_at).where(User.id == user_id))
    ).scalar_one_or_none()
    if u is None:
        return {"online": False, "last_seen_at": None}
    cutoff = datetime.utcnow() - timedelta(seconds=settings.online_window_seconds)
    return {"online": u >= cutoff, "last_seen_at": u.replace(tzinfo=UTC).isoformat()}


@router.get("/{user_id}/lists", response_model=list[ListItemOut])
async def public_lists(
    user_id: int,
    status_value: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[ListItemOut]:
    if status_value and status_value not in LIST_STATUSES:
        raise HTTPException(400, "Invalid status")
    stmt = (
        select(UserList)
        .where(UserList.user_id == user_id)
        .order_by(desc(UserList.updated_at))
    )
    if status_value:
        stmt = stmt.where(UserList.status == status_value)
    rows = (await session.execute(stmt)).scalars().all()
    return [ListItemOut.model_validate(r) for r in rows]
