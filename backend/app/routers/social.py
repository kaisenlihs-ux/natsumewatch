from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import Comment, CommentLike, CommentVote, Rating, Review, User
from app.schemas import (
    CommentIn,
    CommentOut,
    CommentVoteIn,
    RatingIn,
    RatingSummary,
    ReviewIn,
    ReviewOut,
)
from app.security import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/anime/{release_id}", tags=["social"])


# ---------------- Comments ----------------
async def _hydrate_comments(
    session: AsyncSession,
    comments: list[Comment],
    me: User | None,
) -> list[CommentOut]:
    if not comments:
        return []
    ids = [c.id for c in comments]

    # like counts
    likes_rows = await session.execute(
        select(CommentLike.comment_id, func.count(CommentLike.id))
        .where(CommentLike.comment_id.in_(ids))
        .group_by(CommentLike.comment_id)
    )
    like_counts = {cid: int(n) for cid, n in likes_rows.all()}

    # net score: sum of CommentVote.value
    score_rows = await session.execute(
        select(CommentVote.comment_id, func.coalesce(func.sum(CommentVote.value), 0))
        .where(CommentVote.comment_id.in_(ids))
        .group_by(CommentVote.comment_id)
    )
    score_map = {cid: int(s) for cid, s in score_rows.all()}

    my_likes: set[int] = set()
    my_votes: dict[int, int] = {}
    if me:
        ml = await session.execute(
            select(CommentLike.comment_id)
            .where(CommentLike.user_id == me.id, CommentLike.comment_id.in_(ids))
        )
        my_likes = {cid for (cid,) in ml.all()}
        mv = await session.execute(
            select(CommentVote.comment_id, CommentVote.value)
            .where(CommentVote.user_id == me.id, CommentVote.comment_id.in_(ids))
        )
        my_votes = {cid: int(v) for cid, v in mv.all()}

    out: list[CommentOut] = []
    for c in comments:
        out.append(
            CommentOut(
                id=c.id,
                body=c.body,
                parent_id=c.parent_id,
                created_at=c.created_at,
                user=c.user,  # type: ignore[arg-type]
                like_count=like_counts.get(c.id, 0),
                score=score_map.get(c.id, 0),
                liked_by_me=c.id in my_likes,
                vote_by_me=my_votes.get(c.id, 0),
            )
        )
    return out


@router.get("/comments", response_model=list[CommentOut])
async def list_comments(
    release_id: int,
    user: User | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> list[CommentOut]:
    q = await session.execute(
        select(Comment)
        .where(Comment.release_id == release_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.desc())
        .limit(500)
    )
    return await _hydrate_comments(session, list(q.scalars().all()), user)


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
    out = await _hydrate_comments(session, [refreshed.scalar_one()], user)
    return out[0]


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


@router.post("/comments/{comment_id}/like", response_model=CommentOut)
async def toggle_comment_like(
    release_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CommentOut:
    c = (
        await session.execute(
            select(Comment)
            .where(Comment.id == comment_id, Comment.release_id == release_id)
            .options(selectinload(Comment.user))
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    existing = (
        await session.execute(
            select(CommentLike).where(
                CommentLike.user_id == user.id, CommentLike.comment_id == comment_id
            )
        )
    ).scalar_one_or_none()
    if existing:
        await session.delete(existing)
    else:
        session.add(CommentLike(user_id=user.id, comment_id=comment_id))
    await session.commit()
    out = await _hydrate_comments(session, [c], user)
    return out[0]


@router.post("/comments/{comment_id}/vote", response_model=CommentOut)
async def vote_comment(
    release_id: int,
    comment_id: int,
    payload: CommentVoteIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CommentOut:
    c = (
        await session.execute(
            select(Comment)
            .where(Comment.id == comment_id, Comment.release_id == release_id)
            .options(selectinload(Comment.user))
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    existing = (
        await session.execute(
            select(CommentVote).where(
                CommentVote.user_id == user.id, CommentVote.comment_id == comment_id
            )
        )
    ).scalar_one_or_none()
    if payload.value == 0:
        if existing:
            await session.delete(existing)
    elif existing:
        existing.value = payload.value
    else:
        session.add(
            CommentVote(user_id=user.id, comment_id=comment_id, value=payload.value)
        )
    await session.commit()
    out = await _hydrate_comments(session, [c], user)
    return out[0]


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
