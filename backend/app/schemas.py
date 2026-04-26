from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserPublic(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMe(UserPublic):
    email: EmailStr


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_\-]+$")
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

    model_config = {"from_attributes": True}


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
