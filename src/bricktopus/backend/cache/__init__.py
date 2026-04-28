"""Local cache layer.

Backed by SQLite for local dev; same SQLModel definitions work against
Lakebase Postgres when this is deployed as a Databricks App. The cache is the
source of truth the UI reads from — sync jobs ingest external data
(Calendar, Gmail, Notion, ...) into these tables, and queries hit the cache,
never the upstream MCP, so we can scale and stay deterministic.
"""

from .engine import (
    CACHE_DB_PATH,
    create_db_and_tables,
    get_session,
    session_dependency,
)

__all__ = [
    "CACHE_DB_PATH",
    "create_db_and_tables",
    "get_session",
    "session_dependency",
]
