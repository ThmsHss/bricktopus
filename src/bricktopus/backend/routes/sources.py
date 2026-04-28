"""Source-status + manual sync endpoints.

Subagents extend this with feature-specific routes (e.g. /api/time-spent).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from ..cache import session_dependency
from ..mcp_clients import GmailClient, GoogleCalendarClient, NotionClient
from ..sync import sync_calendar, sync_gmail, sync_notion

router = APIRouter(prefix="/sources", tags=["sources"])


class SourceStatusOut(BaseModel):
    name: str
    mode: str
    authenticated: bool
    detail: str


class SourcesStatusOut(BaseModel):
    sources: list[SourceStatusOut]


@router.get(
    "/status",
    response_model=SourcesStatusOut,
    operation_id="sourcesStatus",
)
def sources_status() -> SourcesStatusOut:
    statuses = [
        GoogleCalendarClient().status(),
        GmailClient().status(),
        NotionClient().status(),
    ]
    return SourcesStatusOut(
        sources=[
            SourceStatusOut(
                name=s.name,
                mode=s.mode.value,
                authenticated=s.authenticated,
                detail=s.detail,
            )
            for s in statuses
        ]
    )


class SyncResultOut(BaseModel):
    source: str
    mode: str
    inserted: int
    updated: int
    total: int


@router.post(
    "/sync/calendar",
    response_model=SyncResultOut,
    operation_id="syncCalendar",
)
def trigger_sync_calendar(
    session: session_dependency,
    days_back: int = 365,
    days_forward: int = 30,
) -> SyncResultOut:
    now = datetime.now(tz=timezone.utc)
    res = sync_calendar(
        session=session,
        client=GoogleCalendarClient(),
        starts_after=now - timedelta(days=days_back),
        starts_before=now + timedelta(days=days_forward),
    )
    return SyncResultOut(
        source="google_calendar",
        mode=res.source_mode,
        inserted=res.inserted,
        updated=res.updated,
        total=res.total,
    )


@router.post(
    "/sync/gmail",
    response_model=SyncResultOut,
    operation_id="syncGmail",
)
def trigger_sync_gmail(
    session: session_dependency,
    days_back: int = 90,
) -> SyncResultOut:
    now = datetime.now(tz=timezone.utc)
    res = sync_gmail(
        session=session,
        client=GmailClient(),
        modified_after=now - timedelta(days=days_back),
    )
    return SyncResultOut(
        source="gmail",
        mode=res.source_mode,
        inserted=res.inserted,
        updated=res.updated,
        total=res.total,
    )


@router.post(
    "/sync/notion",
    response_model=SyncResultOut,
    operation_id="syncNotion",
)
def trigger_sync_notion(
    session: session_dependency,
    days_back: int = 365,
) -> SyncResultOut:
    now = datetime.now(tz=timezone.utc)
    res = sync_notion(
        session=session,
        client=NotionClient(),
        edited_after=now - timedelta(days=days_back),
    )
    return SyncResultOut(
        source="notion",
        mode=res.source_mode,
        inserted=res.inserted,
        updated=res.updated,
        total=res.total,
    )
