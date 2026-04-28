"""Calendar ingest. Idempotent: keyed on event id."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from dataclasses import dataclass

from sqlmodel import Session

from ..cache.sources import CalendarEvent, SyncState
from ..mcp_clients.google_calendar import GoogleCalendarClient
from ..services.attribution import attribute, seed_aliases
from ..services.meeting_classifier import classify_meeting_type
from ..services.people_scan import scan_people

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SyncResult:
    inserted: int
    updated: int
    total: int
    source_mode: str


def sync_calendar(
    *,
    session: Session,
    client: GoogleCalendarClient,
    starts_after: datetime,
    starts_before: datetime,
    max_results: int = 5000,
) -> SyncResult:
    """Pull events from Calendar and upsert into the cache.

    Customer attribution and meeting-type classification are applied here so
    query consumers don't redo them. Manual overrides (customer or type) are
    preserved across re-syncs.
    """
    # Ensure customer aliases are present before attribution runs.
    seed_aliases(session)

    state_key = f"calendar:{client.user_email}"
    state = session.get(SyncState, state_key)
    sync_token = state.cursor if state else None

    # First incremental attempt; if the token is stale we fall back to a
    # full window pull below.
    events, next_token = client.list_events(
        max_results=max_results,
        starts_after=starts_after,
        starts_before=starts_before,
        sync_token=sync_token,
    )

    if sync_token and next_token is None and not events:
        # 410 Gone path — token expired. Do a full resync.
        events, next_token = client.list_events(
            max_results=max_results,
            starts_after=starts_after,
            starts_before=starts_before,
        )

    inserted = 0
    updated = 0

    for evt in events:
        attribution = attribute(
            session=session,
            title=evt.summary,
            attendee_emails=evt.attendee_emails,
        )
        meeting_type = classify_meeting_type(
            title=evt.summary,
            attendee_emails=list(evt.attendee_emails),
            description=evt.description,
            self_organized=evt.self_organized,
        )

        existing = session.get(CalendarEvent, evt.id)
        duration = max(0, int((evt.ends_at - evt.starts_at).total_seconds() // 60))
        attendee_csv = ",".join(evt.attendee_emails)

        if existing is None:
            session.add(
                CalendarEvent(
                    id=evt.id,
                    user_email=evt.user_email,
                    summary=evt.summary,
                    description=evt.description,
                    location=evt.location,
                    organizer_email=evt.organizer_email,
                    starts_at=evt.starts_at,
                    ends_at=evt.ends_at,
                    duration_minutes=duration,
                    response_status=evt.response_status,
                    is_all_day=evt.is_all_day,
                    is_recurring=evt.is_recurring,
                    recurring_event_id=evt.recurring_event_id,
                    self_organized=evt.self_organized,
                    attendee_emails=attendee_csv,
                    attendee_count=len(evt.attendee_emails),
                    raw_payload=json.dumps({"summary": evt.summary}),
                    customer_id=attribution.customer_id if attribution else None,
                    meeting_type=meeting_type,
                    classification_source="rule" if attribution else None,
                    fetched_at=datetime.now(tz=timezone.utc),
                )
            )
            inserted += 1
        else:
            # Don't overwrite manually-set classification (customer or type).
            if existing.classification_source != "manual":
                existing.customer_id = (
                    attribution.customer_id if attribution else None
                )
                existing.meeting_type = meeting_type
                existing.classification_source = "rule" if attribution else None
            existing.summary = evt.summary
            existing.description = evt.description
            existing.location = evt.location
            existing.organizer_email = evt.organizer_email
            existing.starts_at = evt.starts_at
            existing.ends_at = evt.ends_at
            existing.duration_minutes = duration
            existing.response_status = evt.response_status
            existing.is_all_day = evt.is_all_day
            existing.is_recurring = evt.is_recurring
            existing.recurring_event_id = evt.recurring_event_id
            existing.self_organized = evt.self_organized
            existing.attendee_emails = attendee_csv
            existing.attendee_count = len(evt.attendee_emails)
            existing.fetched_at = datetime.now(tz=timezone.utc)
            session.add(existing)
            updated += 1

    # Persist the sync cursor — next run uses this to fetch only the delta.
    now = datetime.now(tz=timezone.utc)
    if state is None:
        session.add(
            SyncState(
                source=state_key,
                last_synced_at=now,
                cursor=next_token,
            )
        )
    else:
        state.last_synced_at = now
        state.last_error = None
        if next_token:
            state.cursor = next_token
        session.add(state)

    session.commit()

    # Best-effort: refresh OrgPerson rows from the cache. The upsert helper
    # is idempotent so running over the full cache stays cheap and keeps
    # provenance / last_seen_at fresh. A failure here must not break the
    # primary calendar sync.
    try:
        scan_people(session=session)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("people scan after calendar sync failed: %s", exc)

    return SyncResult(
        inserted=inserted,
        updated=updated,
        total=inserted + updated,
        source_mode=client.status().mode.value,
    )
