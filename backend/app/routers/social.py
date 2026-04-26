from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import Comment, Rating, Review, User
from app.schemas import (
    CommentIn,
    CommentOut,
    RatingIn,
    RatingSummary,
    ReviewIn,
    ReviewOut,
)
from app.security import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/anime/{release_id}", tags=["social"])


# ---------------- Comments ----------------
@router.get("/comments", response_model=list[CommentOut])
async def list_comments(
    release_id: int, session: AsyncSession = Depends(get_session)
) -> list[CommentOut]:
    q = await session.execute(
        select(Comment)
        .where(Comment.release_id == release_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.desc())
        .limit(500)
    )
    return [CommentOut.model_validate(c) for c in q.scalars().all()]


@router.post("/comments", response_model=CommentOut)
async def create_comment(
    release_id: int,
    payload: CommentIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CommentOut:
    c = Comment(
        user_id=user.id,
        release_id=release_id,
        body=payload.body.strip(),
        parent_id=payload.parent_id,
    )
    session.add(c)
    await session.commit()
    refreshed = await session.execute(
        select(Comment).where(Comment.id == c.id).options(selectinload(Comment.user))
    )
    return CommentOut.model_validate(refreshed.scalar_one())


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    release_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    c = (
        await session.execute(
            select(Comment).where(Comment.id == comment_id, Comment.release_id == release_id)
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    if c.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN)
    await session.delete(c)
    await session.commit()


# ---------------- Reviews ----------------
@router.get("/reviews", response_model=list[ReviewOut])
async def list_reviews(
    release_id: int, session: AsyncSession = Depends(get_session)
) -> list[ReviewOut]:
    q = await session.execute(
        select(Review)
        .where(Review.release_id == release_id)
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc())
        .limit(200)
    )
    return [ReviewOut.model_validate(r) for r in q.scalars().all()]


@router.post("/reviews", response_model=ReviewOut)
async def create_review(
    release_id: int,
    payload: ReviewIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReviewOut:
    existing = (
        await session.execute(
            select(Review).where(Review.user_id == user.id, Review.release_id == release_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.title = payload.title
        existing.body = payload.body
        existing.score = payload.score
        await session.commit()
        rid = existing.id
    else:
        r = Review(
            user_id=user.id,
            release_id=release_id,
            title=payload.title,
            body=payload.body,
            score=payload.score,
        )
        session.add(r)
        await session.commit()
        rid = r.id
    refreshed = await session.execute(
        select(Review).where(Review.id == rid).options(selectinload(Review.user))
    )
    return ReviewOut.model_validate(refreshed.scalar_one())


# ---------------- Ratings ----------------
@router.get("/rating", response_model=RatingSummary)
async def rating_summary(
    release_id: int,
    user: User | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> RatingSummary:
    agg = await session.execute(
        select(func.avg(Rating.score), func.count(Rating.id)).where(
            Rating.release_id == release_id
        )
    )
    avg, count = agg.one()
    user_score: float | None = None
    if user:
        my = await session.execute(
            select(Rating.score).where(Rating.user_id == user.id, Rating.release_id == release_id)
        )
        user_score = my.scalar_one_or_none()
    return RatingSummary(average=float(avg or 0), count=int(count or 0), user_score=user_score)


@router.post("/rating", response_model=RatingSummary)
async def set_rating(
    release_id: int,
    payload: RatingIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RatingSummary:
    existing = (
        await session.execute(
            select(Rating).where(Rating.user_id == user.id, Rating.release_id == release_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.score = payload.score
    else:
        session.add(Rating(user_id=user.id, release_id=release_id, score=payload.score))
    await session.commit()
    return await rating_summary(release_id, user, session)


@router.delete("/rating", status_code=204)
async def clear_rating(
    release_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    await session.execute(
        delete(Rating).where(Rating.user_id == user.id, Rating.release_id == release_id)
    )
    await session.commit()
