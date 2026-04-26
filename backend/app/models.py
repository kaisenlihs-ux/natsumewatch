from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    history_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    comments: Mapped[list["Comment"]] = relationship(back_populates="user")
    reviews: Mapped[list["Review"]] = relationship(back_populates="user")
    ratings: Mapped[list["Rating"]] = relationship(back_populates="user")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    release_id: Mapped[int] = mapped_column(Integer, index=True)
    body: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    user: Mapped[User] = relationship(back_populates="comments")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    release_id: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer)  # 1-10
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    user: Mapped[User] = relationship(back_populates="reviews")

    __table_args__ = (
        UniqueConstraint("user_id", "release_id", name="uq_review_user_release"),
    )


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    release_id: Mapped[int] = mapped_column(Integer, index=True)
    score: Mapped[float] = mapped_column(Float)  # 1-10
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="ratings")

    __table_args__ = (
        UniqueConstraint("user_id", "release_id", name="uq_rating_user_release"),
    )


class WatchProgress(Base):
    __tablename__ = "watch_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    release_id: Mapped[int] = mapped_column(Integer, index=True)
    episode_ordinal: Mapped[int] = mapped_column(Integer)
    seconds: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "release_id", "episode_ordinal", name="uq_watch_user_ep"),
    )


# ---------------------------------------------------------------------------
# Lists / Favorites — MAL/Shikimori-style status buckets per user/release.
# ---------------------------------------------------------------------------

# planned   = "Запланировано"  (smotret pozzhe / watch later)
# watching  = "Смотрю"
# watched   = "Просмотрено"
# postponed = "Отложено"
# dropped   = "Брошено"
# favorite  = "Избранное"   (cross-list, not exclusive — managed in code)
LIST_STATUSES: tuple[str, ...] = (
    "planned",
    "watching",
    "watched",
    "postponed",
    "dropped",
    "favorite",
)


class UserList(Base):
    __tablename__ = "user_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    release_id: Mapped[int] = mapped_column(Integer, index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    # Denormalized release snapshot — populated when the row is created so we
    # can render the lists page and compute statistics without re-querying
    # AniLibria for every entry.
    release_alias: Mapped[str | None] = mapped_column(String(128), nullable=True)
    release_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    release_title_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    release_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    release_genres: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    release_poster: Mapped[str | None] = mapped_column(String(512), nullable=True)
    release_episodes_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "release_id", "status", name="uq_userlist_user_release_status"),
    )


class WatchHistory(Base):
    """Append-only log of episodes the user actually started watching."""

    __tablename__ = "watch_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    release_id: Mapped[int] = mapped_column(Integer, index=True)
    release_alias: Mapped[str | None] = mapped_column(String(128), nullable=True)
    release_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    release_poster: Mapped[str | None] = mapped_column(String(512), nullable=True)
    episode_ordinal: Mapped[int] = mapped_column(Integer)
    episode_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_studio: Mapped[str | None] = mapped_column(String(128), nullable=True)
    watched_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )
