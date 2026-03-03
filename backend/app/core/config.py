"""
Application Configuration
Loaded from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ─── App ─────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "super-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ALGORITHM: str = "HS256"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    def validate_secrets(self) -> None:
        """Raise if insecure defaults are used in production."""
        if self.is_production and self.SECRET_KEY == "super-secret-change-in-production":
            raise RuntimeError(
                "SECRET_KEY must be changed for production! "
                "Set the SECRET_KEY environment variable to a secure random string."
            )

    # ─── Database ────────────────────────────────────────────
    # SQLite for local dev, PostgreSQL for production (via Docker)
    DATABASE_URL: str = "sqlite+aiosqlite:///./roombook.db"
    DATABASE_URL_SYNC: str = "sqlite:///./roombook.db"

    # ─── CORS ────────────────────────────────────────────────
    # Comma-separated list via env: CORS_ORIGINS=https://app.example.com,https://admin.example.com
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:80",
        "http://localhost",
    ]

    # ─── Email ───────────────────────────────────────────────
    SENDGRID_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@roombook.internal"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


settings = Settings()
