import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.schemas import LoginIn, RegisterIn, TokenOut, UserMe
from app.security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def allocate_friend_id(session: AsyncSession) -> str:
    """Generate a unique 6–10 digit friend_id. We start at 7-digit codes for
    aesthetics and extend up to 10 digits if collisions become frequent.

    The 7-digit space is 9 million wide which gives us room for ~hundreds of
    thousands of users with negligible collision risk.
    """
    for _ in range(50):
        # 7 digits between 1_000_000 and 9_999_999
        candidate = str(secrets.randbelow(9_000_000) + 1_000_000)
        clash = await session.execute(
            select(User.id).where(User.friend_id == candidate)
        )
        if clash.scalar_one_or_none() is None:
            return candidate
    # Extremely unlikely fallback: widen to 10 digits.
    while True:
        candidate = str(secrets.randbelow(9_000_000_000) + 1_000_000_000)
        clash = await session.execute(
            select(User.id).where(User.friend_id == candidate)
        )
        if clash.scalar_one_or_none() is None:
            return candidate


@router.post("/register", response_model=TokenOut)
async def register(payload: RegisterIn, session: AsyncSession = Depends(get_session)) -> TokenOut:
    existing = await session.execute(
        select(User).where(or_(User.email == payload.email, User.username == payload.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT, "User with this email or username already exists"
        )
    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        friend_id=await allocate_friend_id(session),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserMe.model_validate(user))


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, session: AsyncSession = Depends(get_session)) -> TokenOut:
    q = await session.execute(
        select(User).where(
            or_(User.email == payload.email_or_username, User.username == payload.email_or_username)
        )
    )
    user = q.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.friend_id:
        user.friend_id = await allocate_friend_id(session)
        await session.commit()
        await session.refresh(user)
    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserMe.model_validate(user))


@router.get("/me", response_model=UserMe)
async def me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMe:
    # Backfill friend_id for accounts that pre-date the friends feature.
    if not user.friend_id:
        user.friend_id = await allocate_friend_id(session)
        await session.commit()
        await session.refresh(user)
    return UserMe.model_validate(user)
