"""Wrappers around external data sources.

Each wrapper hides whether we're talking to an MCP server, a REST API, or a
local mock. A wrapper exposes a small typed interface; the sync jobs
(`bricktopus.backend.sync.*`) call into these and write the cache.

Today all three sources fall back to mock fixtures when not authenticated.
Real-mode adapters land as auth is wired up:
- Google Calendar / Gmail: OAuth via the claude.ai MCP servers
- Notion: REST integration token in env (NOTION_TOKEN), or a future MCP
"""

from .base import (
    CalendarEventDTO,
    EmailThreadDTO,
    NotionPageDTO,
    SourceMode,
    SourceStatus,
)
from .google_calendar import GoogleCalendarClient
from .gmail import GmailClient
from .notion import NotionClient

__all__ = [
    "CalendarEventDTO",
    "EmailThreadDTO",
    "NotionPageDTO",
    "SourceMode",
    "SourceStatus",
    "GoogleCalendarClient",
    "GmailClient",
    "NotionClient",
]
