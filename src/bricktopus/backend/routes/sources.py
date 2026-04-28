"""Source-status, connect, and manual sync endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..cache import session_dependency
from ..mcp_clients import (
    GmailClient,
    GoogleCalendarClient,
    NotionClient,
    SalesforceClient,
)
from ..services import secrets
from ..sync import sync_calendar, sync_gmail, sync_notion

router = APIRouter(prefix="/api/sources", tags=["sources"])


# ────────── Status ──────────


class SourceStatusOut(BaseModel):
    name: str
    mode: str
    authenticated: bool
    detail: str
    label: str
    connect_kind: Literal["token", "credentials", "oauth-external"]


class SourcesStatusOut(BaseModel):
    sources: list[SourceStatusOut]


_LABELS = {
    "google_calendar": "Google Calendar",
    "gmail": "Gmail",
    "notion": "Notion",
    "salesforce": "Salesforce",
}

_CONNECT_KINDS: dict[str, Literal["token", "credentials", "oauth-external"]] = {
    "google_calendar": "oauth-external",
    "gmail": "oauth-external",
    "notion": "token",
    "salesforce": "credentials",
}


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
        SalesforceClient().status(),
    ]
    return SourcesStatusOut(
        sources=[
            SourceStatusOut(
                name=s.name,
                mode=s.mode.value,
                authenticated=s.authenticated,
                detail=s.detail,
                label=_LABELS.get(s.name, s.name),
                connect_kind=_CONNECT_KINDS.get(s.name, "token"),
            )
            for s in statuses
        ]
    )


# ────────── Connect ──────────


class NotionConnectIn(BaseModel):
    token: str = Field(min_length=10)
    database_id: Optional[str] = None


class NotionConnectOut(BaseModel):
    ok: bool
    detail: str


@router.post(
    "/connect/notion",
    response_model=NotionConnectOut,
    operation_id="connectNotion",
)
def connect_notion(body: NotionConnectIn) -> NotionConnectOut:
    """Persist a Notion integration token and (optional) database id.

    Validation is light — we trust the token shape (`secret_…` typically).
    The next sync attempt will surface real auth errors with a clear
    message, so we don't try to validate against Notion here.
    """
    secrets.set_value("notion_token", body.token.strip())
    if body.database_id:
        secrets.set_value("notion_database_id", body.database_id.strip())
    return NotionConnectOut(ok=True, detail="Notion token saved.")


@router.delete(
    "/connect/notion",
    response_model=NotionConnectOut,
    operation_id="disconnectNotion",
)
def disconnect_notion() -> NotionConnectOut:
    removed_token = secrets.delete("notion_token")
    secrets.delete("notion_database_id")
    return NotionConnectOut(
        ok=removed_token,
        detail="Notion token removed." if removed_token else "Nothing to remove.",
    )


class SalesforceConnectIn(BaseModel):
    instance_url: str = Field(min_length=4)
    username: str = Field(min_length=3)
    password: str = Field(min_length=1)
    security_token: str = Field(min_length=1)


class SalesforceConnectOut(BaseModel):
    ok: bool
    detail: str


@router.post(
    "/connect/salesforce",
    response_model=SalesforceConnectOut,
    operation_id="connectSalesforce",
)
def connect_salesforce(body: SalesforceConnectIn) -> SalesforceConnectOut:
    secrets.set_value(
        "salesforce",
        {
            "instance_url": body.instance_url.strip(),
            "username": body.username.strip(),
            "password": body.password,
            "security_token": body.security_token.strip(),
        },
    )
    return SalesforceConnectOut(ok=True, detail="Salesforce credentials saved.")


@router.delete(
    "/connect/salesforce",
    response_model=SalesforceConnectOut,
    operation_id="disconnectSalesforce",
)
def disconnect_salesforce() -> SalesforceConnectOut:
    removed = secrets.delete("salesforce")
    return SalesforceConnectOut(
        ok=removed,
        detail=(
            "Salesforce credentials removed."
            if removed
            else "Nothing to remove."
        ),
    )


# ────────── Connect info / setup guides ──────────


class ConnectInfoOut(BaseModel):
    source: str
    label: str
    kind: Literal["token", "credentials", "oauth-external"]
    title: str
    instructions: str
    docs_url: Optional[str] = None


_INFO: dict[str, ConnectInfoOut] = {
    "notion": ConnectInfoOut(
        source="notion",
        label="Notion",
        kind="token",
        title="Connect Notion",
        instructions=(
            "1. Open https://www.notion.so/my-integrations\n"
            "2. Click 'New integration', name it 'Bricktopus', and pick your workspace.\n"
            "3. Copy the *Internal Integration Token* (starts with `secret_…`).\n"
            "4. In Notion, open your meeting-notes database → … → 'Connections' → add your new integration.\n"
            "5. Paste the token below. Optional: paste the database id (the 32-char string after the slash in the database URL)."
        ),
        docs_url="https://developers.notion.com/docs/create-a-notion-integration",
    ),
    "salesforce": ConnectInfoOut(
        source="salesforce",
        label="Salesforce",
        kind="credentials",
        title="Connect Salesforce",
        instructions=(
            "Use a username/password + security token combination from your Salesforce login.\n\n"
            "1. Instance URL: e.g. https://databricks.my.salesforce.com\n"
            "2. Username: your full SF login email.\n"
            "3. Password: your SF password.\n"
            "4. Security token: from Salesforce → Settings → Reset My Security Token.\n\n"
            "These are stored locally at ~/.bricktopus/secrets.json (file-mode 0600). For SSO-only orgs, OAuth is the path forward — we'll wire it next."
        ),
        docs_url="https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm",
    ),
    "google_calendar": ConnectInfoOut(
        source="google_calendar",
        label="Google Calendar",
        kind="oauth-external",
        title="Connect Google Calendar",
        instructions=(
            "Google Calendar requires OAuth 2.0 — the app needs its own Google Cloud project + OAuth client.\n\n"
            "Setup checklist (one-time, ~10 minutes):\n"
            "1. Open Google Cloud Console → create a project (or pick one).\n"
            "2. Enable the Google Calendar API.\n"
            "3. OAuth consent screen → Internal user type → add your email as a test user.\n"
            "4. Credentials → Create OAuth client ID → Web application → authorized redirect URI `http://localhost:9007/api/sources/oauth/google/callback`.\n"
            "5. Download the credentials JSON and place it at `~/.bricktopus/google-credentials.json`.\n"
            "6. Click Connect again here — we'll redirect you through Google's consent flow.\n\n"
            "Until step 4 is complete the Connect button only shows this guide."
        ),
        docs_url="https://developers.google.com/calendar/api/quickstart/python",
    ),
    "gmail": ConnectInfoOut(
        source="gmail",
        label="Gmail",
        kind="oauth-external",
        title="Connect Gmail",
        instructions=(
            "Gmail uses the same Google OAuth flow as Calendar. Once Calendar is connected the Gmail scope is added automatically — connect Calendar first."
        ),
        docs_url="https://developers.google.com/gmail/api/quickstart/python",
    ),
}


@router.get(
    "/connect/{source}/info",
    response_model=ConnectInfoOut,
    operation_id="connectInfo",
)
def connect_info(source: str) -> ConnectInfoOut:
    info = _INFO.get(source)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Unknown source: {source}")
    return info


# ────────── Sync triggers ──────────


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
    max_results: int = 5000,
) -> SyncResultOut:
    now = datetime.now(tz=timezone.utc)
    res = sync_calendar(
        session=session,
        client=GoogleCalendarClient(),
        starts_after=now - timedelta(days=days_back),
        starts_before=now + timedelta(days=days_forward),
        max_results=max_results,
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
