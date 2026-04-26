from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.anilibria import anilibria
from app.config import settings
from app.db import init_db
from app.routers import anime, auth, social, stats


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield
    await anilibria.close()


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


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "NatsumeWatch API", "docs": "/docs"}
