"""Google Calendar wrapper.

Live mode uses Application Default Credentials populated by
`gcloud auth application-default login` (see services/google_adc.py).
When ADC is missing the wrapper falls back to mock fixtures so the UI
keeps working.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from ..services import google_adc
from .base import CalendarEventDTO, SourceMode, SourceStatus

logger = logging.getLogger(__name__)


def _has_oauth() -> bool:
    """Live mode wins as soon as gcloud ADC credentials exist on disk."""
    if os.environ.get("BRICKTOPUS_GCAL_FORCE_MOCK") == "1":
        return False
    return google_adc.adc_present()


class GoogleCalendarClient:
    """Adapter to Google Calendar — ADC-backed when auth is in place."""

    name = "google_calendar"

    def __init__(self, *, user_email: str | None = None) -> None:
        self.user_email = (
            user_email
            or google_adc.adc_email()
            or os.environ.get("BRICKTOPUS_USER_EMAIL")
            or "thomas.hass@databricks.com"
        )

    def status(self) -> SourceStatus:
        live = _has_oauth()
        return SourceStatus(
            name=self.name,
            mode=SourceMode.LIVE if live else SourceMode.MOCK,
            authenticated=live,
            detail=(
                f"Live: gcloud ADC for {self.user_email}."
                if live
                else "Run `gcloud auth application-default login` to switch to live mode."
            ),
        )

    def list_events(
        self,
        *,
        starts_after: datetime,
        starts_before: datetime,
        max_results: int = 250,
        sync_token: Optional[str] = None,
    ) -> tuple[list[CalendarEventDTO], Optional[str]]:
        """Return (events, next_sync_token).

        When `sync_token` is provided, the live path makes an incremental
        request: only events created/updated/deleted since the last sync are
        returned. The first sync (no token) does a full pull within the
        time window and saves the next token for later.
        """
        if _has_oauth():
            return _live_events(
                user_email=self.user_email,
                starts_after=starts_after,
                starts_before=starts_before,
                max_results=max_results,
                sync_token=sync_token,
            )

        events = _mock_events(
            user_email=self.user_email,
            starts_after=starts_after,
            starts_before=starts_before,
            max_results=max_results,
        )
        return events, None


# ---------- Live (Application Default Credentials) ----------


def _live_events(
    *,
    user_email: str,
    starts_after: datetime,
    starts_before: datetime,
    max_results: int,
    sync_token: Optional[str] = None,
) -> tuple[list[CalendarEventDTO], Optional[str]]:
    """Live calendar fetch with incremental syncToken support.

    - If `sync_token` is provided, request only the delta since last sync.
      Google returns 410 Gone if the token is too old; caller should retry
      without it (full resync within the time window).
    - On success, the final response carries `nextSyncToken` — persist it
      for the next call.
    """
    from googleapiclient.errors import HttpError

    service = google_adc.build_service("calendar", "v3")
    page_token: Optional[str] = None
    out: list[CalendarEventDTO] = []
    remaining = max_results
    next_sync_token: Optional[str] = None

    incremental = sync_token is not None

    while remaining > 0:
        page_size = min(remaining, 250)
        kwargs: dict = {
            "calendarId": "primary",
            "singleEvents": True,
            "maxResults": page_size,
            "pageToken": page_token,
        }
        if incremental:
            # syncToken cannot be combined with timeMin/timeMax/orderBy.
            kwargs["syncToken"] = sync_token
        else:
            kwargs["timeMin"] = starts_after.isoformat()
            kwargs["timeMax"] = starts_before.isoformat()
            kwargs["orderBy"] = "startTime"

        try:
            resp = service.events().list(**kwargs).execute()
        except HttpError as exc:
            # 410 Gone → syncToken expired; signal a full resync to caller.
            if exc.resp.status == 410 and incremental:
                logger.info("Calendar syncToken expired — caller should resync.")
                return [], None
            raise

        for raw in resp.get("items", []):
            dto = _parse_event(raw, user_email=user_email)
            if dto is not None:
                out.append(dto)
        page_token = resp.get("nextPageToken")
        next_sync_token = resp.get("nextSyncToken") or next_sync_token
        if not page_token:
            break
        remaining = max_results - len(out)

    return out, next_sync_token


def _parse_event(raw: dict, *, user_email: str) -> Optional[CalendarEventDTO]:
    if raw.get("status") == "cancelled":
        return None
    summary = (raw.get("summary") or "").strip() or "(no title)"
    start_str = raw.get("start", {}).get("dateTime") or raw.get("start", {}).get("date")
    end_str = raw.get("end", {}).get("dateTime") or raw.get("end", {}).get("date")
    if not start_str or not end_str:
        return None
    starts_at = _parse_iso(start_str)
    ends_at = _parse_iso(end_str)
    if starts_at is None or ends_at is None:
        return None

    organizer = (raw.get("organizer") or {}).get("email")
    attendees_raw = raw.get("attendees") or []
    attendees = [a.get("email") for a in attendees_raw if a.get("email")]
    response_status = next(
        (
            a.get("responseStatus")
            for a in attendees_raw
            if a.get("email") == user_email
        ),
        None,
    )
    self_organized = (organizer == user_email) or bool(
        (raw.get("organizer") or {}).get("self")
    )
    is_all_day = "date" in (raw.get("start") or {})

    return CalendarEventDTO(
        id=raw["id"],
        user_email=user_email,
        summary=summary,
        description=raw.get("description"),
        location=raw.get("location"),
        organizer_email=organizer,
        starts_at=starts_at,
        ends_at=ends_at,
        response_status=response_status,
        is_all_day=is_all_day,
        is_recurring=bool(raw.get("recurringEventId")),
        recurring_event_id=raw.get("recurringEventId"),
        self_organized=self_organized,
        attendee_emails=attendees,
    )


def _parse_iso(value: str) -> Optional[datetime]:
    try:
        # Calendar returns 'Z' or +00:00; date-only events come as 'YYYY-MM-DD'.
        if "T" in value:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except ValueError:
        logger.warning("Could not parse calendar datetime: %s", value)
        return None


# ---------- Mock fixtures ----------


def _mock_events(
    *,
    user_email: str,
    starts_after: datetime,
    starts_before: datetime,
    max_results: int,
) -> list[CalendarEventDTO]:
    """Return a small representative slice covering the requested window.

    Designed so the rule-based classifier exercises every code path:
    - external attendees → discovery / demo / cadence / deep-dive
    - self-prep block ("Puma prep") with no external attendee
    - internal-only meetings
    """
    base = max(starts_after, datetime(2026, 4, 1, tzinfo=timezone.utc))
    samples: list[tuple[str, str, list[str], int]] = [
        (
            "PUMA discovery — modern data platform vision",
            "Discovery call with PUMA data leadership.",
            ["felix.hoffmann@puma.com", "anna.mueller@databricks.com"],
            60,
        ),
        (
            "PUMA technical deep-dive: Lakebase",
            "Architecture deep-dive on catalog cache.",
            ["felix.hoffmann@puma.com", "tom.becker@puma.com",
             "marco.rossi@databricks.com"],
            90,
        ),
        (
            "PUMA weekly cadence",
            "Weekly sync with PUMA account team.",
            ["felix.hoffmann@puma.com", "anna.mueller@databricks.com",
             "marco.rossi@databricks.com"],
            45,
        ),
        (
            "PUMA prep — QBR slide review",
            "Self-organized prep block.",
            [],  # no attendees → title regex picks it up
            30,
        ),
        (
            "BioNTech discovery — clinical data platform",
            "Discovery on clinical trial data unification.",
            ["mira.koch@biontech.de", "thomas.hass@databricks.com"],
            60,
        ),
        (
            "BioNTech demo: Mosaic AI for protein design",
            "Demo of fine-tuning workflow.",
            ["mira.koch@biontech.de", "lukas.berg@biontech.de",
             "anna.mueller@databricks.com"],
            45,
        ),
        (
            "Grünenthal cadence",
            "Weekly account sync.",
            ["sven.fischer@grunenthal.com",
             "thomas.hass@databricks.com"],
            45,
        ),
        (
            "Grünenthal best-practices session: Unity Catalog",
            "Best-practices walkthrough on UC governance.",
            ["sven.fischer@grunenthal.com", "marie.weiss@grunenthal.com",
             "marco.rossi@databricks.com"],
            60,
        ),
        (
            "Beiersdorf demo: Genie for marketing analytics",
            "Live demo for the marketing team.",
            ["jan.becker@beiersdorf.com",
             "anna.mueller@databricks.com"],
            45,
        ),
        (
            "Beiersdorf prep — QBR briefing",
            "Self-organized prep before tomorrow's QBR.",
            [],  # title regex picks it up as Beiersdorf prep
            30,
        ),
        (
            "FE EMEA regional sync",
            "Internal team sync.",
            ["regional-leads@databricks.com",
             "thomas.hass@databricks.com"],
            30,
        ),
    ]

    events: list[CalendarEventDTO] = []
    for i, (summary, desc, attendees, dur) in enumerate(samples[:max_results]):
        starts = base + timedelta(days=i, hours=10)
        if starts < starts_after or starts > starts_before:
            continue
        ends = starts + timedelta(minutes=dur)
        organizer: Optional[str] = (
            user_email if "prep" in summary.lower() else (
                attendees[0] if attendees else user_email
            )
        )
        events.append(
            CalendarEventDTO(
                id=f"mock-evt-{i:03d}",
                user_email=user_email,
                summary=summary,
                description=desc,
                location=None,
                organizer_email=organizer,
                starts_at=starts,
                ends_at=ends,
                response_status="accepted",
                is_all_day=False,
                is_recurring=False,
                recurring_event_id=None,
                self_organized=organizer == user_email and not attendees,
                attendee_emails=attendees,
            )
        )
    return events
