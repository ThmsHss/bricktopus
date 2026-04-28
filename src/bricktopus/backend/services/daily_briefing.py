"""Plan-my-day briefing assembler.

Joins today's calendar events with the cached signals we already have:
- customer attribution (already on `CalendarEvent.customer_id`)
- prior meeting count with the same external attendees
- most-recent Notion meeting note for the customer
- most-recent Gmail thread involving any of today's external attendees
- ontology classification per attendee (best-effort — only when the
  parallel ontology branch's `PersonClassification` table exists)
- a deterministic recommendation pulled from a small rule table

This module never calls MCP or the Notion REST API directly; all reads
are served from the SQLite cache. The sync endpoints are the only place
live calls happen.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, Optional

from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..cache.sources import CalendarEvent, CustomerAlias, EmailThread, NotionPage
from .attribution import INTERNAL_CUSTOMER_ID, INTERNAL_CUSTOMER_NAME

logger = logging.getLogger(__name__)


# ---------- Output types ----------


class AttendeeBriefing(BaseModel):
    email: str
    domain: str
    is_internal: bool
    classification: Optional[str] = Field(
        default=None,
        description="Ontology label e.g. 'champion' | 'blocking' | 'evaluator' "
        "if the parallel ontology branch is merged.",
    )


class NotionExcerpt(BaseModel):
    id: str
    title: str
    url: Optional[str]
    last_edited_at: datetime
    excerpt: Optional[str]


class EmailExcerpt(BaseModel):
    id: str
    subject: str
    snippet: Optional[str]
    last_message_at: datetime
    participant_count: int


class MeetingBriefingItem(BaseModel):
    id: str
    title: str
    starts_at: datetime
    ends_at: datetime
    duration_minutes: int
    meeting_type: str
    is_customer_facing: bool
    is_internal: bool
    is_self_organized: bool
    customer_id: Optional[str]
    customer_name: Optional[str]
    attendees: list[AttendeeBriefing]
    prior_meeting_count: int
    last_contact_days_ago: Optional[int]
    notion_note: Optional[NotionExcerpt]
    latest_email: Optional[EmailExcerpt]
    recommendation: str
    calendar_url: Optional[str]


class CustomerChip(BaseModel):
    customer_id: str
    customer_name: str
    meeting_count: int


class DailySummary(BaseModel):
    day: date
    user_email: str
    total_meeting_minutes: int
    customer_facing_minutes: int
    internal_minutes: int
    customer_facing_share: float
    customers: list[CustomerChip]
    meeting_count: int


class DailyBriefingOut(BaseModel):
    summary: DailySummary
    meetings: list[MeetingBriefingItem]
    generated_at: datetime
    notes: list[str] = Field(
        default_factory=list,
        description="Best-effort notes (e.g. 'ontology table missing, "
        "skipped attendee classification').",
    )


# ---------- Meeting-type classifier ----------
# Deterministic keyword heuristic. Time-spent has a richer one — we keep this
# self-contained so plan-my-day works on its own branch.

_MEETING_TYPE_RULES: list[tuple[str, str]] = [
    (r"\bdemo\b|\bwalkthrough\b|\bshow\s*and\s*tell\b", "demo"),
    (r"\bdiscovery\b|\bintro\b|\bkick[- ]?off\b", "discovery"),
    (r"\bdeep[- ]?dive\b|\barchitecture\b|\btechnical\b", "deep-dive"),
    (r"\bprep\b|\bself[- ]?prep\b", "prep"),
    (r"\bcadence\b|\bweekly\b|\bsync\b|\bstandup\b|\bcheck[- ]?in\b", "cadence"),
    (r"\bqbr\b|\breview\b", "review"),
    (r"\bplanning\b|\boffsite\b", "planning"),
]


def classify_meeting_type(title: str, attendee_count: int) -> str:
    """Return a meeting type label from the title.

    Falls back to "internal" when no attendees are external and nothing
    in the title gives us a stronger signal.
    """
    haystack = title.lower()
    for pattern, label in _MEETING_TYPE_RULES:
        if re.search(pattern, haystack):
            return label
    if attendee_count == 0:
        return "prep"
    return "meeting"


# ---------- Recommendation rules ----------

_RECOMMENDATIONS: dict[str, str] = {
    "demo": "Lead with the recent demo recap; surface 1 next-step ask.",
    "discovery": (
        "Establish business priorities + budget posture before pitching "
        "anything specific."
    ),
    "deep-dive": "Bring the architecture artefact and a deferred-question list.",
    "prep": "Self-organized block — quiet work.",
    "review": "Anchor on outcomes vs. plan and surface one decision to make.",
    "planning": "Keep it short, decision-oriented; capture owners + dates.",
}

_DEFAULT_RECOMMENDATION = "Listen for an open topic to follow up on."
_BLOCKING_OVERRIDE = "Stay neutral; collect context, don't push."


def _recommend(
    *,
    meeting_type: str,
    attendees: list[AttendeeBriefing],
) -> str:
    has_blocking = any(
        (a.classification or "").lower() == "blocking" for a in attendees
    )
    if meeting_type == "cadence" and has_blocking:
        return _BLOCKING_OVERRIDE
    if meeting_type == "cadence":
        return (
            "Confirm there's an open question — otherwise make it async and "
            "give the time back."
        )
    return _RECOMMENDATIONS.get(meeting_type, _DEFAULT_RECOMMENDATION)


# ---------- Helpers ----------


def _utc_day_window(day: date) -> tuple[datetime, datetime]:
    """Return [start, end) in UTC for the given calendar day.

    We treat days in UTC for now; surfaced in the API note. A user's
    local zone slot can be added when calendar_sync starts persisting
    organizer timezones.
    """
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end


def _split_attendees(csv: str) -> list[str]:
    return [e.strip() for e in (csv or "").split(",") if e.strip()]


def _domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].strip().lower() if "@" in email else ""


_INTERNAL_DOMAINS = frozenset({"databricks.com"})


def _is_internal_email(email: str) -> bool:
    return _domain(email) in _INTERNAL_DOMAINS


def _customer_name_for(
    session: Session,
    customer_id: Optional[str],
) -> Optional[str]:
    if not customer_id:
        return None
    if customer_id == INTERNAL_CUSTOMER_ID:
        return INTERNAL_CUSTOMER_NAME
    row = session.exec(
        select(CustomerAlias).where(CustomerAlias.customer_id == customer_id)
    ).first()
    return row.customer_name if row else customer_id


def _truncate(text: Optional[str], limit: int = 280) -> Optional[str]:
    if not text:
        return None
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


# ---------- Optional ontology lookup ----------


def _load_classifications(
    session: Session,
    emails: Iterable[str],
) -> dict[str, str]:
    """Look up ontology PersonClassification rows by email.

    Returns an empty dict (and no exception) if the parallel ontology
    branch hasn't been merged yet.
    """
    emails_lower = sorted({e.lower() for e in emails if e})
    if not emails_lower:
        return {}

    try:
        from ..cache import ontology  # type: ignore[attr-defined]
    except ImportError:
        return {}

    PersonClassification = getattr(ontology, "PersonClassification", None)
    if PersonClassification is None:
        return {}

    try:
        rows = session.exec(
            select(PersonClassification).where(
                PersonClassification.email.in_(emails_lower)  # type: ignore[attr-defined]
            )
        ).all()
    except Exception as exc:  # noqa: BLE001
        logger.warning("ontology classification lookup failed: %s", exc)
        return {}

    out: dict[str, str] = {}
    for row in rows:
        email = (getattr(row, "email", "") or "").lower()
        label = getattr(row, "classification", None) or getattr(row, "label", None)
        if email and label:
            out[email] = str(label)
    return out


# ---------- Joins ----------


def _prior_meeting_count(
    session: Session,
    *,
    user_email: str,
    external_emails: list[str],
    excluding_event_id: str,
    before: datetime,
) -> int:
    if not external_emails:
        return 0
    # SQLite has no array overlap; do a substring match per email and union
    # the ids.
    ids: set[str] = set()
    for em in external_emails:
        like = f"%{em.lower()}%"
        rows = session.exec(
            select(CalendarEvent.id).where(
                CalendarEvent.user_email == user_email,
                CalendarEvent.id != excluding_event_id,
                CalendarEvent.starts_at < before,
                CalendarEvent.attendee_emails.ilike(like),  # type: ignore[attr-defined]
            )
        ).all()
        ids.update(rows)
    return len(ids)


def _last_contact_days(
    session: Session,
    *,
    user_email: str,
    external_emails: list[str],
    excluding_event_id: str,
    today: date,
) -> Optional[int]:
    if not external_emails:
        return None
    latest: Optional[datetime] = None
    for em in external_emails:
        like = f"%{em.lower()}%"
        row = session.exec(
            select(CalendarEvent)
            .where(
                CalendarEvent.user_email == user_email,
                CalendarEvent.id != excluding_event_id,
                CalendarEvent.attendee_emails.ilike(like),  # type: ignore[attr-defined]
                CalendarEvent.starts_at
                < datetime.combine(today, time.min, tzinfo=timezone.utc),
            )
            .order_by(CalendarEvent.starts_at.desc())  # type: ignore[attr-defined]
            .limit(1)
        ).first()
        if row and (latest is None or row.starts_at > latest):
            latest = row.starts_at
    if latest is None:
        return None
    delta = today - latest.date()
    return max(0, delta.days)


def _latest_notion_for_customer(
    session: Session,
    customer_id: Optional[str],
) -> Optional[NotionPage]:
    if not customer_id:
        return None
    return session.exec(
        select(NotionPage)
        .where(NotionPage.customer_id == customer_id)
        .order_by(NotionPage.last_edited_at.desc())  # type: ignore[attr-defined]
        .limit(1)
    ).first()


def _latest_email_for_attendees(
    session: Session,
    *,
    user_email: str,
    external_emails: list[str],
) -> Optional[EmailThread]:
    if not external_emails:
        return None
    latest: Optional[EmailThread] = None
    for em in external_emails:
        like = f"%{em.lower()}%"
        row = session.exec(
            select(EmailThread)
            .where(
                EmailThread.user_email == user_email,
                EmailThread.participants.ilike(like),  # type: ignore[attr-defined]
            )
            .order_by(EmailThread.last_message_at.desc())  # type: ignore[attr-defined]
            .limit(1)
        ).first()
        if row and (latest is None or row.last_message_at > latest.last_message_at):
            latest = row
    return latest


# ---------- Top-level assembler ----------


def _today_utc() -> date:
    return datetime.now(tz=timezone.utc).date()


def build_daily_briefing(
    session: Session,
    *,
    user_email: str,
    day: Optional[date] = None,
) -> DailyBriefingOut:
    """Assemble the per-meeting briefing for `day` (default: today UTC)."""
    target_day = day or _today_utc()
    start, end = _utc_day_window(target_day)

    events = session.exec(
        select(CalendarEvent)
        .where(
            CalendarEvent.user_email == user_email,
            CalendarEvent.starts_at >= start,
            CalendarEvent.starts_at < end,
        )
        .order_by(CalendarEvent.starts_at.asc())  # type: ignore[attr-defined]
    ).all()

    # Pre-compute attendee classification lookup for everyone in the day.
    all_attendee_emails: list[str] = []
    for evt in events:
        all_attendee_emails.extend(_split_attendees(evt.attendee_emails))
    classifications = _load_classifications(session, all_attendee_emails)

    notes: list[str] = []
    if all_attendee_emails and not classifications:
        # Heuristic for the user-visible note: only mention if we expected to
        # find rows. We don't know whether the table exists vs. is just empty,
        # so a generic note is fine.
        notes.append(
            "Ontology classifications unavailable on this branch — "
            "attendee labels skipped."
        )

    # Build per-meeting items
    meetings: list[MeetingBriefingItem] = []
    for evt in events:
        attendee_emails = _split_attendees(evt.attendee_emails)
        external_emails = [e for e in attendee_emails if not _is_internal_email(e)]

        attendees = [
            AttendeeBriefing(
                email=e,
                domain=_domain(e),
                is_internal=_is_internal_email(e),
                classification=classifications.get(e.lower()),
            )
            for e in attendee_emails
        ]

        meeting_type = classify_meeting_type(evt.summary, len(external_emails))
        is_internal = (
            evt.customer_id == INTERNAL_CUSTOMER_ID
            or (
                len(attendee_emails) > 0 and len(external_emails) == 0
            )
        )
        is_customer_facing = bool(external_emails) and not is_internal

        prior_count = _prior_meeting_count(
            session,
            user_email=user_email,
            external_emails=external_emails,
            excluding_event_id=evt.id,
            before=start,
        )
        last_contact = _last_contact_days(
            session,
            user_email=user_email,
            external_emails=external_emails,
            excluding_event_id=evt.id,
            today=target_day,
        )

        notion_page = _latest_notion_for_customer(session, evt.customer_id)
        notion_excerpt = (
            NotionExcerpt(
                id=notion_page.id,
                title=notion_page.title,
                url=notion_page.notion_url,
                last_edited_at=notion_page.last_edited_at,
                excerpt=_truncate(notion_page.plain_text),
            )
            if notion_page
            else None
        )

        email = _latest_email_for_attendees(
            session,
            user_email=user_email,
            external_emails=external_emails,
        )
        email_excerpt = (
            EmailExcerpt(
                id=email.id,
                subject=email.subject,
                snippet=_truncate(email.snippet, 220),
                last_message_at=email.last_message_at,
                participant_count=len(_split_attendees(email.participants)),
            )
            if email
            else None
        )

        recommendation = _recommend(
            meeting_type=meeting_type, attendees=attendees
        )

        meetings.append(
            MeetingBriefingItem(
                id=evt.id,
                title=evt.summary,
                starts_at=evt.starts_at,
                ends_at=evt.ends_at,
                duration_minutes=evt.duration_minutes,
                meeting_type=meeting_type,
                is_customer_facing=is_customer_facing,
                is_internal=is_internal,
                is_self_organized=evt.self_organized,
                customer_id=evt.customer_id,
                customer_name=_customer_name_for(session, evt.customer_id),
                attendees=attendees,
                prior_meeting_count=prior_count,
                last_contact_days_ago=last_contact,
                notion_note=notion_excerpt,
                latest_email=email_excerpt,
                recommendation=recommendation,
                calendar_url=None,  # upstream URL not yet persisted
            )
        )

    # Day-level summary
    total_minutes = sum(m.duration_minutes for m in meetings)
    customer_minutes = sum(
        m.duration_minutes for m in meetings if m.is_customer_facing
    )
    internal_minutes = sum(
        m.duration_minutes for m in meetings if m.is_internal
    )
    customer_share = (
        round(customer_minutes / total_minutes, 4) if total_minutes else 0.0
    )

    cust_counter: Counter[tuple[str, str]] = Counter()
    for m in meetings:
        if not m.customer_id:
            continue
        cust_counter[(m.customer_id, m.customer_name or m.customer_id)] += 1
    chips = [
        CustomerChip(
            customer_id=cid, customer_name=name, meeting_count=cnt
        )
        for (cid, name), cnt in cust_counter.most_common()
    ]

    summary = DailySummary(
        day=target_day,
        user_email=user_email,
        total_meeting_minutes=total_minutes,
        customer_facing_minutes=customer_minutes,
        internal_minutes=internal_minutes,
        customer_facing_share=customer_share,
        customers=chips,
        meeting_count=len(meetings),
    )

    return DailyBriefingOut(
        summary=summary,
        meetings=meetings,
        generated_at=datetime.now(tz=timezone.utc),
        notes=notes,
    )
