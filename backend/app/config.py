import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_db_url() -> str:
    # Use the persistent volume on Fly.io / equivalent platforms when present.
    if os.path.isdir("/data"):
        return "sqlite+aiosqlite:////data/app.db"
    return "sqlite+aiosqlite:///./natsumewatch.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = _default_db_url()
    jwt_secret: str = "change-me-in-production-please"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 days

    anilibria_base_url: str = "https://anilibria.top/api/v1"
    anilibria_media_base_url: str = "https://anilibria.top"

    cors_origins: str = "*"

    online_window_seconds: int = 90


settings = Settings()
