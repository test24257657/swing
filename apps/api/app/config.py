from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "development"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://swing:swing@localhost:5432/swing"
    redis_url: str = "redis://localhost:6379/0"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    ingest_backfill_days: int = 250
    raw_cache_dir: str = "./data/raw_cache"

    # Gemini — news impact classification + AI summaries (Phase 7). Empty = feature off.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # Live quote cache TTL — the one allowed live-NSE path
    quote_ttl_seconds: int = 60

    # Auth
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    admin_email: str = ""
    admin_password: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
