from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from . import models
from .config import settings
from .database import Base, engine
from .routers import auth, people

# Dev convenience: create tables if they don't exist.
# For production, use Alembic migrations instead of relying on this.
Base.metadata.create_all(bind=engine)

# The project originally shipped without relationship metadata columns.
# Add them lazily for existing installations so old family data remains
# readable while new records can distinguish adoption, step/unknown links,
# and remarriage/separation.
with engine.begin() as connection:
    existing = {column["name"] for column in inspect(engine).get_columns("family_children")}
    if "relationship_type" not in existing:
        connection.execute(text("ALTER TABLE family_children ADD COLUMN relationship_type VARCHAR"))
    existing_units = {column["name"] for column in inspect(engine).get_columns("family_units")}
    if "relationship_status" not in existing_units:
        connection.execute(text("ALTER TABLE family_units ADD COLUMN relationship_status VARCHAR"))

app = FastAPI(title="Rootline API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # Vite may expose the local preview on either localhost or 127.0.0.1.
    # CORS treats those as separate origins, so allow both during local use.
    allow_origins=[settings.frontend_url, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(people.router)


@app.get("/health")
def health():
    return {"status": "ok"}
