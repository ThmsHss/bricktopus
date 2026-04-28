"""Per-event listing + manual reclassification.

Powers the "click a bucket → reclassify events" flow on the Overview's
Time Spent panel. Manual edits set classification_source='manual' so the
rule-based classifier won't overwrite them on the next sync.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import select

from ..cache import session_dependency
from ..cache.sources import CalendarEvent, CustomerAlias

router = APIRouter(prefix="/api/calendar-events", tags=["calendar-events"])

MeetingType = Literal[
    "discovery", "demo", "cadence", "deep-dive", "prep", "admin", "other"
]


class CalendarEventOut(BaseModel):
    id: str
    summary: str
    starts_at: datetime
    ends_at: datetime
    duration_minutes: int
    organizer_email: Optional[str]
    response_status: Optional[str]
    self_organized: bool
    is_all_day: bool
    attendee_count: int
    customer_id: Optional[str]
    customer_name: Optional[str]
    meeting_type: Optional[str]
    classification_source: Optional[str]


class CalendarEventListOut(BaseModel):
    events: list[CalendarEventOut]
    total: int


def _customer_name_lookup(session) -> dict[str, str]:  # noqa: ANN001
    aliases = session.exec(select(CustomerAlias)).all()
    out: dict[str, str] = {}
    for alias in aliases:
        out.setdefault(alias.customer_id, alias.customer_name)
    out.setdefault("internal", "Internal · Databricks")
    out.setdefault("other", "Other / Unattributed")
    return out


def _to_out(evt: CalendarEvent, names: dict[str, str]) -> CalendarEventOut:
    return CalendarEventOut(
        id=evt.id,
        summary=evt.summary,
        starts_at=evt.starts_at,
        ends_at=evt.ends_at,
        duration_minutes=evt.duration_minutes,
        organizer_email=evt.organizer_email,
        response_status=evt.response_status,
        self_organized=evt.self_organized,
        is_all_day=evt.is_all_day,
        attendee_count=evt.attendee_count,
        customer_id=evt.customer_id,
        customer_name=names.get(evt.customer_id) if evt.customer_id else None,
        meeting_type=evt.meeting_type,
        classification_source=evt.classification_source,
    )


def _parse_iso_date(value: Optional[str], *, default: date) -> date:
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date {value!r}; expected YYYY-MM-DD",
        ) from exc


@router.get(
    "",
    response_model=CalendarEventListOut,
    operation_id="listCalendarEvents",
)
def list_calendar_events(
    session: session_dependency,
    customer_id: Optional[str] = Query(default=None),
    start: Optional[str] = Query(default=None),
    end: Optional[str] = Query(default=None),
    limit: int = Query(default=500, le=2000),
) -> CalendarEventListOut:
    """List events, optionally filtered by customer + date range.

    Pass `customer_id="other"` to fetch the unattributed bucket
    (events where customer_id IS NULL or = 'other').
    """
    today = datetime.now(tz=timezone.utc).date()
    range_start = _parse_iso_date(start, default=today - timedelta(days=84))
    range_end = _parse_iso_date(end, default=today + timedelta(days=1))

    range_start_dt = datetime.combine(
        range_start, datetime.min.time(), tzinfo=timezone.utc
    )
    range_end_dt = datetime.combine(
        range_end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
    )

    stmt = (
        select(CalendarEvent)
        .where(CalendarEvent.starts_at >= range_start_dt)
        .where(CalendarEvent.starts_at < range_end_dt)
        .order_by(CalendarEvent.starts_at.desc())
        .limit(limit)
    )

    if customer_id == "other":
        stmt = stmt.where(CalendarEvent.customer_id.is_(None))
    elif customer_id:
        stmt = stmt.where(CalendarEvent.customer_id == customer_id)

    rows = session.exec(stmt).all()
    names = _customer_name_lookup(session)
    return CalendarEventListOut(
        events=[_to_out(r, names) for r in rows],
        total=len(rows),
    )


class ClassificationPatch(BaseModel):
    customer_id: Optional[str] = None  # null/empty clears
    meeting_type: Optional[MeetingType] = None


@router.patch(
    "/{event_id}/classification",
    response_model=CalendarEventOut,
    operation_id="updateEventClassification",
)
def update_event_classification(
    session: session_dependency,
    event_id: str,
    body: ClassificationPatch,
) -> CalendarEventOut:
    """Manually override an event's customer + meeting_type.

    Sets `classification_source='manual'` so subsequent rule-based syncs
    leave this event alone.
    """
    evt = session.get(CalendarEvent, event_id)
    if evt is None:
        raise HTTPException(status_code=404, detail=f"No event {event_id!r}")

    cid = (body.customer_id or "").strip().lower() or None
    if cid == "":
        cid = None

    evt.customer_id = cid
    if body.meeting_type:
        evt.meeting_type = body.meeting_type
    evt.classification_source = "manual"
    session.add(evt)
    session.commit()
    session.refresh(evt)

    names = _customer_name_lookup(session)
    return _to_out(evt, names)


class CustomerOption(BaseModel):
    customer_id: str
    customer_name: str


class CustomerOptionsOut(BaseModel):
    customers: list[CustomerOption]


@router.get(
    "/customer-options",
    response_model=CustomerOptionsOut,
    operation_id="customerOptions",
)
def customer_options(session: session_dependency) -> CustomerOptionsOut:
    """All known customer ids (from aliases) + the special 'internal' /
    'other' buckets, ready for the reclassify dropdown."""
    names = _customer_name_lookup(session)
    options = [
        CustomerOption(customer_id=cid, customer_name=name)
        for cid, name in sorted(names.items(), key=lambda kv: kv[1])
    ]
    return CustomerOptionsOut(customers=options)
