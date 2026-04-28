"""SQLite engine + session helpers for the local cache.

The cache file path is configurable via the BRICKTOPUS_CACHE_DB env var; the
default lives under the user's home so it survives across project copies.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

_DEFAULT_CACHE_PATH = Path.home() / ".bricktopus" / "cache.db"
CACHE_DB_PATH = Path(os.environ.get("BRICKTOPUS_CACHE_DB", _DEFAULT_CACHE_PATH))

_engine: Engine | None = None


def _get_engine() -> Engine:
    global _engine
    if _engine is None:
        CACHE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False because FastAPI shares the engine across
        # request workers; SQLModel/SQLAlchemy handles per-session isolation.
        _engine = create_engine(
            f"sqlite:///{CACHE_DB_PATH}",
            connect_args={"check_same_thread": False},
            echo=False,
        )

        @event.listens_for(_engine, "connect")
        def _enable_sqlite_pragmas(dbapi_connection, _connection_record):  # noqa: ANN001
            cursor = dbapi_connection.cursor()
            # WAL gives us safe concurrent reads while a writer is active.
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return _engine


def create_db_and_tables() -> None:
    """Create any registered tables. Safe to call repeatedly (no-op if exist)."""
    # Import side-effect: ensures every cache.* module has registered its
    # SQLModel tables on the metadata before create_all is called.
    from . import ontology, people, sources  # noqa: F401

    SQLModel.metadata.create_all(_get_engine())


def get_session() -> Generator[Session, None, None]:
    """Yield a SQLModel session bound to the cache engine."""
    with Session(_get_engine()) as session:
        yield session


# FastAPI dependency annotation
session_dependency = Annotated[Session, Depends(get_session)]
