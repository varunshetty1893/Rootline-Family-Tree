import os
from pathlib import Path

from dotenv import dotenv_values
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    reset_token_expire_minutes: int = 30

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    frontend_url: str = "http://localhost:5173"

    # Resolve this from the source file rather than the process working
    # directory. This keeps `python -m uvicorn app.main:app` pointed at
    # backend/.env even when Uvicorn is launched from another directory.
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8")


settings = Settings()


def database_config_source() -> str:
    """Describe where DATABASE_URL came from without exposing credentials."""
    file_value = dotenv_values(ENV_FILE).get("DATABASE_URL") if ENV_FILE.exists() else None
    environment_value = os.environ.get("DATABASE_URL")
    if environment_value and file_value and environment_value != file_value:
        return "process environment (overrides backend/.env)"
    if environment_value:
        return "process environment"
    if file_value:
        return str(ENV_FILE)
    return "Pydantic settings/defaults"
