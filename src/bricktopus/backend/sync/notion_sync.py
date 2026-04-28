"""Notion ingest. Idempotent: keyed on page id."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session

from ..cache.sources import NotionPage, SyncState
from ..mcp_clients.notion import NotionClient
from ..services.attribution import attribute, seed_aliases


@dataclass(frozen=True)
class SyncResult:
    inserted: int
    updated: int
    total: int
    source_mode: str


def sync_notion(
    *,
    session: Session,
    client: NotionClient,
    edited_after: datetime,
) -> SyncResult:
    seed_aliases(session)
    pages = client.list_meeting_notes(edited_after=edited_after)

    inserted = 0
    updated = 0

    for p in pages:
        attribution_hint: Optional[str] = None
        # Notion props sometimes carry an explicit "Account" select — prefer
        # it when present.
        account_prop = (p.properties.get("Account") or {}) if isinstance(
            p.properties, dict
        ) else {}
        if isinstance(account_prop, str):
            attribution_hint = account_prop
        elif isinstance(account_prop, dict):
            sel = account_prop.get("select") or account_prop.get("name")
            if isinstance(sel, dict):
                attribution_hint = sel.get("name")
            elif isinstance(sel, str):
                attribution_hint = sel

        attribution = attribute(
            session=session,
            title=f"{p.title} {attribution_hint or ''}",
            attendee_emails=[],
        )

        existing = session.get(NotionPage, p.id)
        properties_json = json.dumps(p.properties, default=str)

        if existing is None:
            session.add(
                NotionPage(
                    id=p.id,
                    title=p.title,
                    parent_database_id=p.parent_database_id,
                    notion_url=p.notion_url,
                    last_edited_at=p.last_edited_at,
                    created_at=p.created_at,
                    properties_json=properties_json,
                    plain_text=p.plain_text,
                    customer_id=attribution.customer_id if attribution else None,
                    fetched_at=datetime.now(tz=timezone.utc),
                )
            )
            inserted += 1
        else:
            existing.title = p.title
            existing.parent_database_id = p.parent_database_id
            existing.notion_url = p.notion_url
            existing.last_edited_at = p.last_edited_at
            existing.properties_json = properties_json
            existing.plain_text = p.plain_text
            existing.customer_id = attribution.customer_id if attribution else None
            existing.fetched_at = datetime.now(tz=timezone.utc)
            session.add(existing)
            updated += 1

    state_key = f"notion:{client.database_id}"
    state = session.get(SyncState, state_key)
    now = datetime.now(tz=timezone.utc)
    if state is None:
        session.add(SyncState(source=state_key, last_synced_at=now))
    else:
        state.last_synced_at = now
        state.last_error = None
        session.add(state)

    session.commit()
    return SyncResult(
        inserted=inserted,
        updated=updated,
        total=inserted + updated,
        source_mode=client.status().mode.value,
    )
