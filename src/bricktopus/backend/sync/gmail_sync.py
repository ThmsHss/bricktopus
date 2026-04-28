"""Gmail ingest. Idempotent: keyed on thread id."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlmodel import Session

from ..cache.sources import EmailThread, SyncState
from ..mcp_clients.gmail import GmailClient
from ..services.attribution import attribute


@dataclass(frozen=True)
class SyncResult:
    inserted: int
    updated: int
    total: int
    source_mode: str


def sync_gmail(
    *,
    session: Session,
    client: GmailClient,
    modified_after: datetime,
) -> SyncResult:
    threads = client.list_threads(modified_after=modified_after)

    inserted = 0
    updated = 0

    for t in threads:
        attribution = attribute(
            session=session,
            title=t.subject,
            attendee_emails=t.participants,
        )

        existing = session.get(EmailThread, t.id)
        if existing is None:
            session.add(
                EmailThread(
                    id=t.id,
                    user_email=t.user_email,
                    subject=t.subject,
                    snippet=t.snippet,
                    participants=",".join(t.participants),
                    last_message_at=t.last_message_at,
                    message_count=t.message_count,
                    label_ids=",".join(t.label_ids),
                    customer_id=attribution.customer_id if attribution else None,
                    fetched_at=datetime.now(tz=timezone.utc),
                )
            )
            inserted += 1
        else:
            existing.subject = t.subject
            existing.snippet = t.snippet
            existing.participants = ",".join(t.participants)
            existing.last_message_at = t.last_message_at
            existing.message_count = t.message_count
            existing.label_ids = ",".join(t.label_ids)
            existing.customer_id = attribution.customer_id if attribution else None
            existing.fetched_at = datetime.now(tz=timezone.utc)
            session.add(existing)
            updated += 1

    state_key = f"gmail:{client.user_email}"
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
