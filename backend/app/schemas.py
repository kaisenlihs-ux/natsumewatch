from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserPublic(BaseModel):
    id: int
    username: str
    friend_id: str | None = None
    avatar_url: str | None = None
    banner_url: str | None = None
    bio: str | None = None
    last_seen_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMe(UserPublic):
    email: EmailStr
    history_enabled: bool = True


class RegisterIn(BaseModel):
    # Allow Latin, Cyrillic, digits, dot, dash, underscore. We deliberately keep
    # this permissive — the only thing we really want to reject is whitespace
    # and emoji-style unicode punctuation that breaks `/u/<username>` URLs.
    username: str = Field(
        min_length=3,
        max_length=32,
        pattern=r"^[a-zA-Z0-9\u0400-\u04FF._\-]+$",
    )
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email_or_username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserMe


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    parent_id: int | None = None


class CommentOut(BaseModel):
    id: int
    body: str
    parent_id: int | None
    created_at: datetime
    user: UserPublic
    like_count: int = 0
    score: int = 0  # net up - down votes
    liked_by_me: bool = False
    vote_by_me: int = 0  # -1 / 0 / 1

    model_config = {"from_attributes": True}


class CommentVoteIn(BaseModel):
    value: int = Field(ge=-1, le=1)  # -1 down, 0 clear, +1 up


class ReviewIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=10, max_length=10000)
    score: int = Field(ge=1, le=10)


class ReviewOut(BaseModel):
    id: int
    title: str
    body: str
    score: int
    created_at: datetime
    user: UserPublic

    model_config = {"from_attributes": True}


class RatingIn(BaseModel):
    score: float = Field(ge=1, le=10)


class RatingSummary(BaseModel):
    average: float
    count: int
    user_score: float | None = None


class WatchProgressIn(BaseModel):
    episode_ordinal: int
    seconds: float


class OnlineStats(BaseModel):
    online: int


# ----------------------- User profile / settings -----------------------


class ProfileSettingsIn(BaseModel):
    bio: str | None = Field(default=None, max_length=2000)
    history_enabled: bool | None = None


# ----------------------- Lists -----------------------


class ListItemIn(BaseModel):
    release_id: int
    status: str = Field(pattern=r"^(planned|watching|watched|postponed|dropped|favorite)$")
    note: str | None = Field(default=None, max_length=2000)


class ListItemOut(BaseModel):
    id: int
    release_id: int
    release_alias: str | None
    release_title: str | None
    release_title_en: str | None
    release_year: int | None
    release_type: str | None
    release_genres: list[str] | None
    release_poster: str | None
    release_episodes_total: int | None
    status: str
    note: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ListStatusCount(BaseModel):
    status: str
    count: int


# ----------------------- History -----------------------


class HistoryEntryIn(BaseModel):
    release_id: int
    episode_ordinal: int
    episode_name: str | None = None
    source_provider: str | None = None
    source_studio: str | None = None


class HistoryEntryOut(BaseModel):
    id: int
    release_id: int
    release_alias: str | None
    release_title: str | None
    release_poster: str | None
    episode_ordinal: int
    episode_name: str | None
    source_provider: str | None
    source_studio: str | None
    watched_at: datetime

    model_config = {"from_attributes": True}


# ----------------------- Stats -----------------------


class StatsBucket(BaseModel):
    label: str
    count: int


class ProfileStats(BaseModel):
    total_watched: int
    total_watching: int
    total_planned: int
    total_postponed: int
    total_dropped: int
    total_favorite: int
    by_genre: list[StatsBucket]
    by_type: list[StatsBucket]
    by_year: list[StatsBucket]


# ----------------------- Friends & messages -----------------------


class FriendRequestIn(BaseModel):
    # Either a username or a numeric friend_id (digits-only string).
    target: str = Field(min_length=1, max_length=64)


class FriendOut(BaseModel):
    friendship_id: int
    user: UserPublic
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread: int = 0


class FriendRequestOut(BaseModel):
    id: int
    user: UserPublic  # the *other* party (requester for incoming, target for outgoing)
    created_at: datetime


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: int
    from_user_id: int
    to_user_id: int
    body: str
    created_at: datetime
    read_at: datetime | None = None

    model_config = {"from_attributes": True}
