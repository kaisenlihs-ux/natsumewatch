"""Provider-agnostic OAuth login.

Flow:
1. The browser hits ``/api/auth/{provider}/start`` with a ``?return_to=...``
   pointing at the frontend URL we should land on after login. We respond
   with a 302 redirect to the provider's authorize URL with our state.
2. The provider redirects back to ``/api/auth/{provider}/callback`` with a
   ``code`` and our ``state``. We exchange it for an access token, fetch the
   user profile, find-or-create the local ``User`` row, mint a JWT, and 302
   the browser to ``return_to#token=<jwt>``.

Adding a new provider is a matter of dropping a ``ProviderConfig`` into
``PROVIDERS`` below.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import SessionLocal
from app.models import User
from app.routers.auth import allocate_friend_id
from app.security import create_access_token, hash_password

router = APIRouter(prefix="/api/auth", tags=["oauth"])


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    authorize_url: str
    token_url: str
    profile_url: str
    scopes: str
    # Headers to send when requesting the profile (e.g. Authorization).
    profile_auth: str = "bearer"


PROVIDERS: dict[str, ProviderConfig] = {
    "discord": ProviderConfig(
        name="discord",
        authorize_url="https://discord.com/oauth2/authorize",
        token_url="https://discord.com/api/oauth2/token",
        profile_url="https://discord.com/api/users/@me",
        scopes="identify email",
    ),
    "google": ProviderConfig(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        profile_url="https://openidconnect.googleapis.com/v1/userinfo",
        scopes="openid email profile",
    ),
}


def _credentials(provider: str) -> tuple[str, str]:
    if provider == "discord":
        return settings.discord_oauth_client_id, settings.discord_oauth_client_secret
    if provider == "google":
        return settings.google_oauth_client_id, settings.google_oauth_client_secret
    raise HTTPException(404, f"Unknown provider {provider!r}")


# In-memory state store. Each entry is short-lived (10 min). For a
# multi-instance deployment we'd swap this for Redis, but the bot runs as a
# single Fly.io machine so this is fine for now.
_STATE: dict[str, tuple[float, str]] = {}
_STATE_TTL = 600.0


def _now() -> float:
    import time

    return time.time()


def _state_put(return_to: str) -> str:
    nonce = secrets.token_urlsafe(24)
    _STATE[nonce] = (_now() + _STATE_TTL, return_to)
    # Garbage-collect expired entries opportunistically.
    expired = [k for k, (exp, _) in _STATE.items() if exp < _now()]
    for k in expired:
        _STATE.pop(k, None)
    return nonce


def _state_pop(nonce: str) -> str | None:
    item = _STATE.pop(nonce, None)
    if not item:
        return None
    exp, ret = item
    if exp < _now():
        return None
    return ret


def _redirect_uri(request: Request, provider: str) -> str:
    base = settings.oauth_redirect_base.rstrip("/")
    if not base:
        base = str(request.base_url).rstrip("/")
    return f"{base}/api/auth/{provider}/callback"


def _frontend_base(request: Request) -> str:
    # The frontend is the static export, served from a different host. Default
    # to FRONTEND_BASE_URL; otherwise fall back to the Origin/Referer header.
    if settings.frontend_base_url:
        return settings.frontend_base_url.rstrip("/")
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin:
        # Strip trailing path components.
        from urllib.parse import urlparse

        parsed = urlparse(origin)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return ""


def _provider_status(provider: str) -> bool:
    cid, cs = _credentials(provider)
    return bool(cid and cs)


@router.get("/providers")
async def providers() -> dict[str, bool]:
    """List which providers are configured (have client_id+secret)."""
    out: dict[str, bool] = {}
    for name in PROVIDERS:
        try:
            out[name] = _provider_status(name)
        except HTTPException:
            out[name] = False
    return out


@router.get("/{provider}/start")
async def start(provider: str, request: Request, return_to: str = "") -> RedirectResponse:
    cfg = PROVIDERS.get(provider)
    if not cfg:
        raise HTTPException(404, "Unknown provider")
    client_id, client_secret = _credentials(provider)
    if not client_id or not client_secret:
        raise HTTPException(503, f"OAuth provider {provider!r} is not configured")

    fallback = _frontend_base(request) or "/"
    target = return_to or fallback
    state = _state_put(target)
    redirect_uri = _redirect_uri(request, provider)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": cfg.scopes,
        "state": state,
        "prompt": "consent" if provider == "google" else "none",
    }
    if provider == "google":
        params["access_type"] = "online"
    return RedirectResponse(f"{cfg.authorize_url}?{urlencode(params)}")


async def _exchange_code(
    cfg: ProviderConfig, code: str, redirect_uri: str
) -> dict[str, Any]:
    client_id, client_secret = _credentials(cfg.name)
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            cfg.token_url,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        r.raise_for_status()
        return r.json()


async def _fetch_profile(cfg: ProviderConfig, access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.get(
            cfg.profile_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        return r.json()


def _normalize_profile(provider: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Return ``{subject, email, username, avatar_url}``. ``subject`` is the
    provider-specific user id; the other fields are best-effort."""
    if provider == "discord":
        subject = str(raw.get("id"))
        username = (
            raw.get("global_name")
            or raw.get("username")
            or f"discord_{subject[-6:]}"
        )
        email = raw.get("email")
        avatar = raw.get("avatar")
        avatar_url = (
            f"https://cdn.discordapp.com/avatars/{subject}/{avatar}.png"
            if avatar and subject
            else None
        )
        return {
            "subject": subject,
            "email": email,
            "username": username,
            "avatar_url": avatar_url,
        }
    if provider == "google":
        subject = str(raw.get("sub"))
        username = (
            raw.get("name")
            or (raw.get("email") or "").split("@")[0]
            or f"google_{subject[-6:]}"
        )
        return {
            "subject": subject,
            "email": raw.get("email"),
            "username": username,
            "avatar_url": raw.get("picture"),
        }
    raise HTTPException(500, f"Unsupported provider {provider!r}")


def _slugify_username(name: str) -> str:
    # Match RegisterIn pattern: latin/cyrillic/digits + . _ -. Anything else
    # becomes "_".
    out: list[str] = []
    for ch in name:
        if ch.isalnum() or ch in "._-":
            out.append(ch)
        elif ch == " ":
            out.append("_")
    s = "".join(out).strip("._-") or "user"
    return s[:32]


async def _ensure_unique_username(session: AsyncSession, base: str) -> str:
    base = _slugify_username(base) or "user"
    candidate = base
    suffix = 0
    while True:
        row = await session.execute(select(User.id).where(User.username == candidate))
        if row.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{base}{suffix}"[:32]


async def _find_or_create_user(
    session: AsyncSession, provider: str, profile: dict[str, Any]
) -> User:
    subject = profile["subject"]
    email = profile.get("email")

    # 1. Match by (provider, subject) — repeat logins.
    row = await session.execute(
        select(User).where(
            User.oauth_provider == provider, User.oauth_subject == subject
        )
    )
    user = row.scalar_one_or_none()
    if user:
        return user

    # 2. Match by email — link the OAuth identity to an existing local account.
    if email:
        row = await session.execute(select(User).where(User.email == email))
        user = row.scalar_one_or_none()
        if user:
            user.oauth_provider = provider
            user.oauth_subject = subject
            if not user.avatar_url and profile.get("avatar_url"):
                user.avatar_url = profile["avatar_url"]
            await session.commit()
            await session.refresh(user)
            return user

    # 3. Create a brand-new account.
    username = await _ensure_unique_username(
        session, profile.get("username") or f"{provider}_{subject[-6:]}"
    )
    fallback_email = email or f"{provider}_{subject}@oauth.local"
    # OAuth-only users get a random password hash so they can't be guessed
    # into via the email/password flow. They can later set a real password
    # from settings if they want a non-OAuth login path.
    user = User(
        username=username,
        email=fallback_email,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        oauth_provider=provider,
        oauth_subject=subject,
        avatar_url=profile.get("avatar_url"),
        friend_id=await allocate_friend_id(session),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


def _redirect_back(
    target: str, *, token: str | None = None, error: str | None = None
) -> RedirectResponse:
    if not target:
        target = "/"
    sep = "&" if "?" in target else "?"
    if token:
        url = f"{target}{sep}auth_token={token}"
    elif error:
        url = f"{target}{sep}auth_error={error}"
    else:
        url = target
    return RedirectResponse(url, status_code=status.HTTP_302_FOUND)


@router.get("/{provider}/callback")
async def callback(
    provider: str, request: Request, code: str = "", state: str = ""
) -> RedirectResponse:
    cfg = PROVIDERS.get(provider)
    if not cfg:
        raise HTTPException(404, "Unknown provider")
    return_to = _state_pop(state) or _frontend_base(request) or "/"
    if not code:
        return _redirect_back(return_to, error="missing_code")
    redirect_uri = _redirect_uri(request, provider)
    try:
        token_resp = await _exchange_code(cfg, code, redirect_uri)
        access_token = token_resp.get("access_token")
        if not access_token:
            return _redirect_back(return_to, error="no_access_token")
        raw = await _fetch_profile(cfg, access_token)
    except httpx.HTTPError as exc:
        return _redirect_back(return_to, error=f"upstream_{exc.__class__.__name__}")

    profile = _normalize_profile(provider, raw)
    if not profile.get("subject"):
        return _redirect_back(return_to, error="no_subject")

    try:
        async with SessionLocal() as session:
            user = await _find_or_create_user(session, provider, profile)
            if not user.friend_id:
                user.friend_id = await allocate_friend_id(session)
                await session.commit()
                await session.refresh(user)
    except Exception as exc:  # noqa: BLE001 - surface to user via redirect
        import logging

        logging.getLogger(__name__).exception("OAuth callback failed")
        return _redirect_back(return_to, error=f"db_{exc.__class__.__name__}")

    jwt = create_access_token(user.id)
    return _redirect_back(return_to, token=jwt)


@router.post("/oauth/exchange")
async def exchange_token_in_query(token: str) -> dict[str, Any]:
    """Helper kept for symmetry; the frontend reads ``auth_token`` from the
    URL fragment and stores it. This endpoint exists for clients that prefer
    a JSON handshake instead of fragment parsing."""
    return {"access_token": token, "token_type": "bearer"}
