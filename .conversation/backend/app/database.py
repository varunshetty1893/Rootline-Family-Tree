from urllib.parse import urlsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import database_config_source, settings


def _safe_database_target(url: str) -> str:
    """Return connection target details without ever logging the password."""
    try:
        parsed = urlsplit(url)
        host = parsed.hostname or "<missing>"
        port = parsed.port or "<default>"
        database = parsed.path.lstrip("/") or "<missing>"
        username = parsed.username or "<missing>"
        return f"user={username} host={host} port={port} database={database}"
    except ValueError:
        return "invalid DATABASE_URL"


print(
    "[Rootline] SQLAlchemy database target: "
    f"{_safe_database_target(settings.database_url)}; "
    f"source={database_config_source()}"
)

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
