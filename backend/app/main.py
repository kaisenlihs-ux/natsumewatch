import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.anilibria import anilibria
from app.config import settings
from app.db import init_db
from app.jikan import jikan
from app.kodik import kodik
from app.routers import anime, auth, friends, me, oauth, social, stats, users
from app.shikimori import shikimori


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    os.makedirs(settings.uploads_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.uploads_dir, "avatars"), exist_ok=True)
    os.makedirs(os.path.join(settings.uploads_dir, "banners"), exist_ok=True)
    yield
    await anilibria.close()
    await jikan.close()
    await kodik.close()
    await shikimori.close()


app = FastAPI(
    title="NatsumeWatch API",
    version="0.1.0",
    description="Anime streaming backend powered by AniLibria",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(anime.router)
app.include_router(social.router)
app.include_router(stats.router)
app.include_router(me.router)
app.include_router(users.router)
app.include_router(friends.router)
app.include_router(friends.messages_router)
app.include_router(oauth.router)

# Static serving for user-uploaded media (avatars / banners). The directory is
# created on startup; mounting before it exists raises RuntimeError.
os.makedirs(settings.uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "NatsumeWatch API", "docs": "/docs"}
