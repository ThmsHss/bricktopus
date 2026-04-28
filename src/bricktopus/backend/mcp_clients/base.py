"""Shared types + protocols for MCP / data-source clients."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class SourceMode(str, Enum):
    """Whether a wrapper is currently returning mocked or live data."""

    MOCK = "mock"
    LIVE = "live"


@dataclass(frozen=True)
class SourceStatus:
    name: str
    mode: SourceMode
    authenticated: bool
    detail: str = ""


@dataclass(frozen=True)
class CalendarEventDTO:
    id: str
    user_email: str
    summary: str
    description: Optional[str]
    location: Optional[str]
    organizer_email: Optional[str]
    starts_at: datetime
    ends_at: datetime
    response_status: Optional[str]
    is_all_day: bool
    is_recurring: bool
    recurring_event_id: Optional[str]
    self_organized: bool
    attendee_emails: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class EmailThreadDTO:
    id: str
    user_email: str
    subject: str
    snippet: Optional[str]
    participants: list[str]
    last_message_at: datetime
    message_count: int
    label_ids: list[str]


@dataclass(frozen=True)
class NotionPageDTO:
    id: str
    title: str
    parent_database_id: Optional[str]
    notion_url: Optional[str]
    last_edited_at: datetime
    created_at: Optional[datetime]
    properties: dict
    plain_text: Optional[str]
