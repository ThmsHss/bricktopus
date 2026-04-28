"""Notion wrapper.

There is no Notion MCP configured locally; we use the Notion REST API
directly when a NOTION_TOKEN env var is present (a Notion internal
integration token, https://www.notion.so/my-integrations). Until that's
set we return mock fixtures keyed off the meeting-notes database id the
user shared.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from .base import NotionPageDTO, SourceMode, SourceStatus

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"
DEFAULT_DB_ID = os.environ.get(
    "BRICKTOPUS_NOTION_DB_ID",
    "31f15df3-1802-8127-89cd-e7c616449a61",  # user-shared meeting-notes DB
)


def _token() -> Optional[str]:
    tok = os.environ.get("NOTION_TOKEN")
    return tok.strip() if tok else None


class NotionClient:
    name = "notion"

    def __init__(self, *, database_id: str | None = None) -> None:
        self.database_id = database_id or DEFAULT_DB_ID

    def status(self) -> SourceStatus:
        live = _token() is not None
        return SourceStatus(
            name=self.name,
            mode=SourceMode.LIVE if live else SourceMode.MOCK,
            authenticated=live,
            detail=(
                f"Notion REST integration connected (db {self.database_id})."
                if live
                else (
                    "NOTION_TOKEN not set. Create an internal integration at "
                    "https://www.notion.so/my-integrations, share the meeting-"
                    "notes DB with it, and add NOTION_TOKEN=secret_... to .env."
                )
            ),
        )

    def list_meeting_notes(
        self,
        *,
        edited_after: datetime,
        page_size: int = 100,
    ) -> list[NotionPageDTO]:
        token = _token()
        if not token:
            return _mock_pages(edited_after=edited_after, page_size=page_size)

        # Live path: query the meeting-notes database.
        # https://developers.notion.com/reference/post-database-query
        headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
        }
        body: dict = {
            "page_size": min(page_size, 100),
            "filter": {
                "timestamp": "last_edited_time",
                "last_edited_time": {"after": edited_after.isoformat()},
            },
        }
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                f"{NOTION_API}/databases/{self.database_id}/query",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            payload = resp.json()

        pages: list[NotionPageDTO] = []
        for item in payload.get("results", []):
            pid = item["id"]
            props = item.get("properties", {})
            title = _extract_title(props)
            edited = _parse_dt(item.get("last_edited_time"))
            created = _parse_dt(item.get("created_time"))
            pages.append(
                NotionPageDTO(
                    id=pid,
                    title=title,
                    parent_database_id=self.database_id,
                    notion_url=item.get("url"),
                    last_edited_at=edited or datetime.now(tz=timezone.utc),
                    created_at=created,
                    properties=props,
                    plain_text=None,  # bodies fetched on demand
                )
            )
        return pages


def _extract_title(props: dict) -> str:
    for prop in props.values():
        if prop.get("type") == "title":
            chunks = prop.get("title", [])
            return "".join(c.get("plain_text", "") for c in chunks).strip()
    return ""


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


# ---------- Mock fixtures ----------


def _mock_pages(*, edited_after: datetime, page_size: int) -> list[NotionPageDTO]:
    base = datetime.now(tz=timezone.utc)
    samples: list[tuple[str, int, dict]] = [
        (
            "PUMA — Lakebase architecture sync",
            2,
            {"Account": "PUMA", "Type": "Deep dive"},
        ),
        (
            "PUMA — weekly cadence (Apr 22)",
            6,
            {"Account": "PUMA", "Type": "Cadence"},
        ),
        (
            "adidas — Genie pilot kickoff",
            5,
            {"Account": "adidas", "Type": "Demo"},
        ),
        (
            "FE — Q3 planning offsite",
            10,
            {"Account": "Internal", "Type": "Planning"},
        ),
    ]

    out: list[NotionPageDTO] = []
    for i, (title, days_ago, props) in enumerate(samples[:page_size]):
        edited = base - timedelta(days=days_ago)
        if edited < edited_after:
            continue
        out.append(
            NotionPageDTO(
                id=f"mock-note-{i:03d}",
                title=title,
                parent_database_id=DEFAULT_DB_ID,
                notion_url=None,
                last_edited_at=edited,
                created_at=edited - timedelta(hours=2),
                properties=props,
                plain_text=None,
            )
        )
    return out
