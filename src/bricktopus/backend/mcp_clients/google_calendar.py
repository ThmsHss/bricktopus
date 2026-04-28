"""Google Calendar wrapper.

Live mode is wired through the claude.ai Google Calendar MCP. Until OAuth is
completed for the user, we return a small fixture sized to make the UI
shake out. Subagents and sync jobs use the same DTO shape regardless.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from .base import CalendarEventDTO, SourceMode, SourceStatus


def _has_oauth() -> bool:
    """Detect (best-effort) whether the calendar MCP has been authenticated.

    True positives: env var set explicitly. The MCP itself is the canonical
    source of truth at runtime — we just need a quick local hint.
    """
    return os.environ.get("BRICKTOPUS_GCAL_AUTHENTICATED") == "1"


class GoogleCalendarClient:
    """Adapter to Google Calendar — MCP-backed when auth is in place."""

    name = "google_calendar"

    def __init__(self, *, user_email: str | None = None) -> None:
        self.user_email = user_email or os.environ.get(
            "BRICKTOPUS_USER_EMAIL", "thomas.hass@databricks.com"
        )

    def status(self) -> SourceStatus:
        live = _has_oauth()
        return SourceStatus(
            name=self.name,
            mode=SourceMode.LIVE if live else SourceMode.MOCK,
            authenticated=live,
            detail=(
                "Google Calendar MCP authenticated."
                if live
                else "Google Calendar MCP not authenticated yet — using mock fixtures."
            ),
        )

    def list_events(
        self,
        *,
        starts_after: datetime,
        starts_before: datetime,
        max_results: int = 250,
    ) -> list[CalendarEventDTO]:
        if _has_oauth():
            # Real MCP integration plugs in here. The MCP exposes
            # `events.list`-style tools post-OAuth; the sync layer should
            # call them via the apx MCP gateway. For now this branch is a
            # placeholder so live mode doesn't silently fall back to mock.
            raise NotImplementedError(
                "Google Calendar MCP live calls not yet wired — implement once OAuth completes."
            )

        return _mock_events(
            user_email=self.user_email,
            starts_after=starts_after,
            starts_before=starts_before,
            max_results=max_results,
        )


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
            "adidas demo: Mosaic recsys",
            "Live walkthrough.",
            ["leo.weber@adidas.com", "anna.mueller@databricks.com"],
            45,
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
