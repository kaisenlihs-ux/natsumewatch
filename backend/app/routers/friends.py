"""Friends + 1:1 direct messages."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Friendship, Message, User
from app.schemas import (
    FriendOut,
    FriendRequestIn,
    FriendRequestOut,
    MessageIn,
    MessageOut,
    UserPublic,
)
from app.security import get_current_user

router = APIRouter(prefix="/api/friends", tags=["friends"])
messages_router = APIRouter(prefix="/api/messages", tags=["messages"])


# ---------- helpers --------------------------------------------------------


async def _resolve_target(session: AsyncSession, q: str) -> User | None:
    """Resolve a `target` string to a User. The string is either a username or
    a digits-only friend_id."""
    q = q.strip()
    if not q:
        return None
    if q.isdigit():
        row = await session.execute(select(User).where(User.friend_id == q))
    else:
        row = await session.execute(select(User).where(User.username == q))
    return row.scalar_one_or_none()


async def _get_friendship(
    session: AsyncSession, a: int, b: int
) -> Friendship | None:
    row = await session.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == a, Friendship.target_id == b),
                and_(Friendship.user_id == b, Friendship.target_id == a),
            )
        )
    )
    return row.scalar_one_or_none()


async def _ensure_friendship(
    session: AsyncSession, me_id: int, other_id: int
) -> Friendship:
    fr = await _get_friendship(session, me_id, other_id)
    if not fr or fr.status != "accepted":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not friends")
    return fr


# ---------- search & relationship state -----------------------------------


@router.get("/search", response_model=list[UserPublic])
async def search_users(
    q: str,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[UserPublic]:
    q = q.strip()
    if len(q) < 2:
        return []
    if q.isdigit():
        rows = await session.execute(
            select(User).where(User.friend_id == q).limit(20)
        )
    else:
        like = f"%{q.lower()}%"
        rows = await session.execute(
            select(User)
            .where(func.lower(User.username).like(like))
            .order_by(User.username)
            .limit(20)
        )
    users = [u for u in rows.scalars().all() if u.id != me.id]
    return [UserPublic.model_validate(u) for u in users]


# ---------- list friends + incoming/outgoing requests ---------------------


@router.get("", response_model=list[FriendOut])
@router.get("/", response_model=list[FriendOut])
async def list_friends(
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FriendOut]:
    rows = await session.execute(
        select(Friendship).where(
            and_(
                Friendship.status == "accepted",
                or_(Friendship.user_id == me.id, Friendship.target_id == me.id),
            )
        )
    )
    accepted = rows.scalars().all()
    other_ids = [
        f.target_id if f.user_id == me.id else f.user_id for f in accepted
    ]
    fid_by_other: dict[int, int] = {
        (f.target_id if f.user_id == me.id else f.user_id): f.id
        for f in accepted
    }
    if not other_ids:
        return []
    user_rows = await session.execute(select(User).where(User.id.in_(other_ids)))
    users = {u.id: u for u in user_rows.scalars().all()}

    # Last message per friend (newest first)
    msg_rows = await session.execute(
        select(Message)
        .where(
            or_(
                and_(
                    Message.from_user_id == me.id, Message.to_user_id.in_(other_ids)
                ),
                and_(
                    Message.to_user_id == me.id, Message.from_user_id.in_(other_ids)
                ),
            )
        )
        .order_by(desc(Message.created_at))
    )
    last_by: dict[int, Message] = {}
    for m in msg_rows.scalars().all():
        other = m.to_user_id if m.from_user_id == me.id else m.from_user_id
        if other not in last_by:
            last_by[other] = m

    # Unread counts per friend (messages addressed to me, not yet read)
    unread_rows = await session.execute(
        select(Message.from_user_id, func.count(Message.id))
        .where(
            and_(
                Message.to_user_id == me.id,
                Message.read_at.is_(None),
                Message.from_user_id.in_(other_ids),
            )
        )
        .group_by(Message.from_user_id)
    )
    unread_by = {uid: int(c) for uid, c in unread_rows.all()}

    out: list[FriendOut] = []
    for oid in other_ids:
        u = users.get(oid)
        if not u:
            continue
        last = last_by.get(oid)
        out.append(
            FriendOut(
                friendship_id=fid_by_other[oid],
                user=UserPublic.model_validate(u),
                last_message=last.body if last else None,
                last_message_at=last.created_at if last else None,
                unread=unread_by.get(oid, 0),
            )
        )
    # Sort: those with messages first (newest), then alphabetical
    out.sort(
        key=lambda f: (
            f.last_message_at is None,
            -(f.last_message_at.timestamp() if f.last_message_at else 0),
            f.user.username.lower(),
        )
    )
    return out


@router.get("/incoming", response_model=list[FriendRequestOut])
async def list_incoming(
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FriendRequestOut]:
    rows = await session.execute(
        select(Friendship)
        .where(
            and_(Friendship.target_id == me.id, Friendship.status == "pending")
        )
        .order_by(desc(Friendship.created_at))
    )
    items = rows.scalars().all()
    if not items:
        return []
    user_rows = await session.execute(
        select(User).where(User.id.in_([f.user_id for f in items]))
    )
    users = {u.id: u for u in user_rows.scalars().all()}
    return [
        FriendRequestOut(
            id=f.id,
            user=UserPublic.model_validate(users[f.user_id]),
            created_at=f.created_at,
        )
        for f in items
        if f.user_id in users
    ]


@router.get("/outgoing", response_model=list[FriendRequestOut])
async def list_outgoing(
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FriendRequestOut]:
    rows = await session.execute(
        select(Friendship)
        .where(and_(Friendship.user_id == me.id, Friendship.status == "pending"))
        .order_by(desc(Friendship.created_at))
    )
    items = rows.scalars().all()
    if not items:
        return []
    user_rows = await session.execute(
        select(User).where(User.id.in_([f.target_id for f in items]))
    )
    users = {u.id: u for u in user_rows.scalars().all()}
    return [
        FriendRequestOut(
            id=f.id,
            user=UserPublic.model_validate(users[f.target_id]),
            created_at=f.created_at,
        )
        for f in items
        if f.target_id in users
    ]


# ---------- mutating actions ----------------------------------------------


@router.post("/request", response_model=dict[str, Any])
async def send_request(
    payload: FriendRequestIn,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    target = await _resolve_target(session, payload.target)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    if target.id == me.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя добавить себя")

    existing = await _get_friendship(session, me.id, target.id)
    if existing:
        if existing.status == "accepted":
            return {"status": "accepted", "id": existing.id}
        # If the other side already requested us, accept now.
        if existing.user_id == target.id and existing.status == "pending":
            existing.status = "accepted"
            existing.accepted_at = datetime.utcnow()
            await session.commit()
            return {"status": "accepted", "id": existing.id}
        return {"status": "pending", "id": existing.id}

    fr = Friendship(user_id=me.id, target_id=target.id, status="pending")
    session.add(fr)
    await session.commit()
    await session.refresh(fr)
    return {"status": "pending", "id": fr.id}


@router.post("/{friendship_id}/accept", response_model=dict[str, Any])
async def accept_request(
    friendship_id: int,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await session.execute(
        select(Friendship).where(Friendship.id == friendship_id)
    )
    fr = row.scalar_one_or_none()
    if not fr or fr.target_id != me.id or fr.status != "pending":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заявка не найдена")
    fr.status = "accepted"
    fr.accepted_at = datetime.utcnow()
    await session.commit()
    return {"status": "accepted", "id": fr.id}


@router.post("/{friendship_id}/decline", response_model=dict[str, Any])
async def decline_request(
    friendship_id: int,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await session.execute(
        select(Friendship).where(Friendship.id == friendship_id)
    )
    fr = row.scalar_one_or_none()
    if not fr or fr.target_id != me.id or fr.status != "pending":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заявка не найдена")
    await session.delete(fr)
    await session.commit()
    return {"status": "declined"}


@router.delete("/{friendship_id}", response_model=dict[str, Any])
async def remove(
    friendship_id: int,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    row = await session.execute(
        select(Friendship).where(Friendship.id == friendship_id)
    )
    fr = row.scalar_one_or_none()
    if not fr or me.id not in (fr.user_id, fr.target_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Не найдено")
    await session.delete(fr)
    await session.commit()
    return {"status": "removed"}


# ---------- direct messages -----------------------------------------------


async def _resolve_friend_user(
    session: AsyncSession, me: User, who: str
) -> User:
    other = await _resolve_target(session, who)
    if other is None or other.id == me.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    await _ensure_friendship(session, me.id, other.id)
    return other


@messages_router.get("/{who}", response_model=dict[str, Any])
async def conversation(
    who: str,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    other = await _resolve_friend_user(session, me, who)
    rows = await session.execute(
        select(Message)
        .where(
            or_(
                and_(Message.from_user_id == me.id, Message.to_user_id == other.id),
                and_(Message.from_user_id == other.id, Message.to_user_id == me.id),
            )
        )
        .order_by(Message.created_at)
        .limit(500)
    )
    msgs = rows.scalars().all()

    # Mark unread incoming as read.
    now = datetime.utcnow()
    changed = False
    for m in msgs:
        if m.to_user_id == me.id and m.read_at is None:
            m.read_at = now
            changed = True
    if changed:
        await session.commit()

    return {
        "user": UserPublic.model_validate(other).model_dump(mode="json"),
        "messages": [MessageOut.model_validate(m).model_dump(mode="json") for m in msgs],
    }


@messages_router.post("/{who}", response_model=MessageOut)
async def send_message(
    who: str,
    payload: MessageIn,
    me: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MessageOut:
    other = await _resolve_friend_user(session, me, who)
    msg = Message(from_user_id=me.id, to_user_id=other.id, body=payload.body)
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    return MessageOut.model_validate(msg)
