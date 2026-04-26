from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./natsumewatch.db"
    jwt_secret: str = "change-me-in-production-please"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 days

    anilibria_base_url: str = "https://anilibria.top/api/v1"
    anilibria_media_base_url: str = "https://anilibria.top"

    cors_origins: str = "*"

    online_window_seconds: int = 90


settings = Settings()
