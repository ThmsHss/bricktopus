"""Cache tables for ingested external data (Calendar, Gmail, Notion).

Designed to be idempotent: each row keys on the upstream id (event id,
gmail message id, notion page id) so re-running ingest is a safe upsert.

Time-spent and plan-my-day features build on top of these tables.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CalendarEvent(SQLModel, table=True):
    """A single calendar event pulled from Google Calendar."""

    __tablename__ = "calendar_events"

    id: str = Field(primary_key=True, description="Google Calendar event id")
    user_email: str = Field(index=True, description="Calendar owner")
    summary: str = ""
    description: Optional[str] = None
    location: Optional[str] = None
    organizer_email: Optional[str] = Field(default=None, index=True)
    starts_at: datetime = Field(index=True)
    ends_at: datetime
    duration_minutes: int = 0
    response_status: Optional[str] = None  # accepted/declined/tentative/needsAction
    is_all_day: bool = False
    is_recurring: bool = False
    recurring_event_id: Optional[str] = None
    self_organized: bool = False
    attendee_emails: str = Field(default="", description="comma-separated")
    attendee_count: int = 0
    raw_payload: Optional[str] = Field(default=None, description="JSON of the upstream event")

    # Derived fields, populated by classifier
    customer_id: Optional[str] = Field(default=None, index=True)
    meeting_type: Optional[str] = Field(default=None, index=True)
    classification_source: Optional[str] = Field(
        default=None,
        description="rule | manual | inherited",
    )

    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class EmailThread(SQLModel, table=True):
    """A summarized Gmail thread surfaced by ingest.

    We only keep what's needed for "plan-my-day" — subject, participants,
    last activity. Full bodies stay in Gmail; we link out for detail.
    """

    __tablename__ = "email_threads"

    id: str = Field(primary_key=True, description="Gmail thread id")
    user_email: str = Field(index=True)
    subject: str = ""
    snippet: Optional[str] = None
    participants: str = Field(default="", description="comma-separated emails")
    last_message_at: datetime = Field(index=True)
    message_count: int = 0
    label_ids: Optional[str] = None  # comma-separated label ids
    customer_id: Optional[str] = Field(default=None, index=True)
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class NotionPage(SQLModel, table=True):
    """A single Notion page (typically a meeting note or account brief)."""

    __tablename__ = "notion_pages"

    id: str = Field(primary_key=True, description="Notion page id")
    title: str = ""
    parent_database_id: Optional[str] = Field(default=None, index=True)
    notion_url: Optional[str] = None
    last_edited_at: datetime = Field(index=True)
    created_at: Optional[datetime] = None
    properties_json: Optional[str] = Field(
        default=None,
        description="Raw Notion properties dict, JSON-encoded",
    )
    plain_text: Optional[str] = None
    customer_id: Optional[str] = Field(default=None, index=True)
    meeting_date: Optional[datetime] = Field(default=None, index=True)
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class CustomerAlias(SQLModel, table=True):
    """Maps email-domain or title-regex aliases to a customer id.

    Seeded from a static config + extensible at runtime via API later.
    """

    __tablename__ = "customer_aliases"

    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: str = Field(index=True, description="Stable id, e.g. 'puma'")
    customer_name: str
    match_kind: str = Field(
        description="email_domain | title_regex",
        index=True,
    )
    pattern: str = Field(description="Domain or regex string")
    priority: int = Field(default=100, description="Lower wins on collision")


class SyncState(SQLModel, table=True):
    """Per-source ingest cursor (sync_token, last fetched window).

    One row per source label (e.g. 'calendar:thomas.hass@databricks.com').
    """

    __tablename__ = "sync_state"

    source: str = Field(primary_key=True)
    last_synced_at: datetime = Field(default_factory=datetime.utcnow)
    cursor: Optional[str] = None  # opaque sync token / pagination cursor
    last_error: Optional[str] = None
