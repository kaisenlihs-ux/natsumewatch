from fastapi import APIRouter, Body

from app.presence import presence
from app.schemas import OnlineStats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/online", response_model=OnlineStats)
async def online() -> OnlineStats:
    return OnlineStats(online=presence.online())


@router.post("/heartbeat", response_model=OnlineStats)
async def heartbeat(session_id: str = Body(..., embed=True)) -> OnlineStats:
    presence.heartbeat(session_id)
    return OnlineStats(online=presence.online())
