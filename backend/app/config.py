import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_db_url() -> str:
    # Use the persistent volume on Fly.io / equivalent platforms when present.
    if os.path.isdir("/data"):
        return "sqlite+aiosqlite:////data/app.db"
    return "sqlite+aiosqlite:///./natsumewatch.db"


def _default_uploads_dir() -> str:
    if os.path.isdir("/data"):
        return "/data/uploads"
    return os.path.abspath("./uploads")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = _default_db_url()
    uploads_dir: str = _default_uploads_dir()
    public_base_url: str = ""  # set to fully-qualified host (e.g. https://api.example.com) so
    #                           uploaded media URLs are resolvable from the static frontend.
    kodik_token: str = ""
    jwt_secret: str = "change-me-in-production-please"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 days

    anilibria_base_url: str = "https://anilibria.top/api/v1"
    anilibria_media_base_url: str = "https://anilibria.top"

    cors_origins: str = "*"

    online_window_seconds: int = 90
    max_upload_bytes: int = 5 * 1024 * 1024  # 5 MB


settings = Settings()
