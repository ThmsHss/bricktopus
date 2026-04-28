"""Time-spent aggregation endpoint.

Reads from the local calendar cache, groups by (bucket, customer, type),
and returns a structure ready for the Overview "Where I spend my time"
card. All times are kept in UTC at storage and bucketed in UTC; the UI
can convert to local TZ at the edge if it ever matters.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import select

from ..cache import session_dependency
from ..cache.sources import CalendarEvent, CustomerAlias

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/time-spent", tags=["time-spent"])

Bucket = Literal["week", "month"]

# An event counts as "time you actually spent" only when:
#   - you accepted it explicitly, OR
#   - you organized it yourself (self_organized=True) AND no other attendees
#     dispute that (i.e. response_status in {None, "accepted"}).
# `needsAction` events are invites that were never confirmed — treating them
# as attended balloons the totals with stuff you never went to.
_ACCEPTED_LITERAL = "accepted"

# Cap any single event at 4 hours. Real meetings rarely run that long;
# anything bigger is usually a focus block or a misused calendar entry.
MAX_MINUTES_PER_EVENT = 240

# Self-organized blockers we should NOT count as time spent. Matched
# case-insensitively against the event summary.
_BLOCKER_PATTERNS = (
    "no meeting",
    "no calls",
    "no call",
    "do not schedule",
    "do not book",
    "out of office",
    "ooo",
    "vacation",
    "holiday",
    "pto",
    "lunch",
    "focus",
    "deep work",
    "deep-work",
    "busy",
    "blocked",
    "blocker",
    "personal work",
    "personal time",
    "summarize the day",
    "stand-in",
    "stand in",
    "travel",
    "train to",
    "flight",
    "drive home",
    "drive to",
    "commute",
    "review consumption",
    "check release notes",
)


def _is_blocker(summary: str) -> bool:
    s = (summary or "").lower()
    return any(p in s for p in _BLOCKER_PATTERNS)


def _did_attend(evt) -> bool:  # noqa: ANN001 — duck-typed CalendarEvent
    """Did the user actually attend this event (not just get invited)?

    True for explicit "accepted", or for self-organized blocks with no
    competing attendees. False for "declined", "tentative", and the very
    common "needsAction" (silently invited, never confirmed).
    """
    status = (evt.response_status or "").lower() or None
    if status == _ACCEPTED_LITERAL:
        return True
    if status in {"declined", "tentative", "needsaction"}:
        return False
    # No status set: count it only when it's clearly your own block.
    if evt.self_organized:
        return True
    if evt.attendee_count <= 0:
        return True
    return False

INTERNAL_CUSTOMER_ID = "internal"
INTERNAL_CUSTOMER_NAME = "Internal · Databricks"


class TypeBreakdown(BaseModel):
    discovery: int = 0
    demo: int = 0
    cadence: int = 0
    deep_dive: int = 0
    prep: int = 0
    other: int = 0


class CustomerBucketEntry(BaseModel):
    customer_id: str
    customer_name: str
    minutes: int
    by_type: dict[str, int]


class TimeBucket(BaseModel):
    bucket_start: str
    bucket_label: str
    customer_breakdown: list[CustomerBucketEntry]
    total_minutes: int


class CustomerTotal(BaseModel):
    customer_id: str
    customer_name: str
    minutes: int


class TimeSpentResponse(BaseModel):
    buckets: list[TimeBucket]
    totals_by_customer: list[CustomerTotal]
    totals_by_type: dict[str, int]
    range_start: str
    range_end: str
    bucket: str
    total_minutes: int
    event_count: int


def _humanize_customer_id(customer_id: str) -> str:
    """Best-effort name when no alias is registered.

    Replaces underscores/dashes with spaces and title-cases the result.
    """
    return customer_id.replace("_", " ").replace("-", " ").strip().title()


def _customer_name_lookup(session) -> dict[str, str]:
    """Build a customer_id → display name map from the alias table."""
    aliases = session.exec(select(CustomerAlias)).all()
    out: dict[str, str] = {}
    for alias in aliases:
        # First seen wins — aliases for the same customer share names anyway.
        out.setdefault(alias.customer_id, alias.customer_name)
    out.setdefault(INTERNAL_CUSTOMER_ID, INTERNAL_CUSTOMER_NAME)
    out.setdefault("other", "Other / Unattributed")
    return out


def _week_start(d: datetime) -> date:
    """Monday of the ISO week containing `d`."""
    plain = d.date() if isinstance(d, datetime) else d
    iso_year, iso_week, _ = plain.isocalendar()
    return date.fromisocalendar(iso_year, iso_week, 1)


def _month_start(d: datetime) -> date:
    plain = d.date() if isinstance(d, datetime) else d
    return plain.replace(day=1)


def _format_label(bucket_start: date, bucket: Bucket) -> str:
    if bucket == "week":
        # "Apr 21" — short, dense; year falls out of the date axis context.
        return bucket_start.strftime("%b %d")
    return bucket_start.strftime("%b %Y")


def _parse_iso_date(value: str | None, *, default: date) -> date:
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
    response_model=TimeSpentResponse,
    operation_id="getTimeSpent",
)
def get_time_spent(
    session: session_dependency,
    bucket: Bucket = Query(default="week"),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
) -> TimeSpentResponse:
    today = datetime.now(tz=timezone.utc).date()
    # Default to a recent window so the chart isn't dominated by Jan when
    # we're in late April. Week view → last 12 weeks; Month view → last 6 months.
    default_back_days = 12 * 7 if bucket == "week" else 6 * 30
    default_start = today - timedelta(days=default_back_days)
    range_start = _parse_iso_date(start, default=default_start)
    range_end = _parse_iso_date(end, default=today)

    if range_end < range_start:
        raise HTTPException(
            status_code=400,
            detail="`end` must be on or after `start`.",
        )

    range_start_dt = datetime.combine(range_start, datetime.min.time(), tzinfo=timezone.utc)
    range_end_dt = datetime.combine(
        range_end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
    )

    stmt = (
        select(CalendarEvent)
        .where(CalendarEvent.starts_at >= range_start_dt)
        .where(CalendarEvent.starts_at < range_end_dt)
    )
    events = session.exec(stmt).all()

    name_for = _customer_name_lookup(session)

    # First pass: filter + flatten into a single chronological stream so
    # parallel meetings can be deduped across customers in one shot.
    # Each entry: (start, end, customer_id, meeting_type, duration_minutes).
    flat: list[tuple[datetime, datetime, str, str, int]] = []
    counted_events = 0

    bucketize = _week_start if bucket == "week" else _month_start

    for evt in events:
        if evt.duration_minutes <= 0:
            continue
        if evt.is_all_day:
            continue
        if not _did_attend(evt):
            continue
        # Skip generic blockers ("No Meeting Friday", "OOO", "lunch", …) so
        # empty time isn't booked as work time.
        if _is_blocker(evt.summary):
            continue

        capped = min(evt.duration_minutes, MAX_MINUTES_PER_EVENT)
        end = evt.starts_at + timedelta(minutes=capped)
        customer_id = evt.customer_id or "other"
        meeting_type = evt.meeting_type or "other"
        flat.append(
            (evt.starts_at, end, customer_id, meeting_type, capped)
        )
        counted_events += 1

    # Sweep-line: walk events in order; for each minute already covered by a
    # previously-picked event, skip it. The first meeting starting in any
    # gap "wins" that segment — its customer + type get the credit.
    flat.sort(key=lambda x: (x[0], -x[4]))  # earlier starts first; longer wins ties
    attributed: list[tuple[datetime, datetime, str, str]] = []
    cursor: datetime | None = None
    for start, end, cid, mt, _dur in flat:
        if cursor is not None and start < cursor:
            start = cursor
        if start >= end:
            continue
        attributed.append((start, end, cid, mt))
        cursor = end

    grouped: dict[date, dict[str, _Aggregate]] = defaultdict(
        lambda: defaultdict(_Aggregate)
    )
    totals_customer: dict[str, int] = defaultdict(int)
    totals_type: dict[str, int] = defaultdict(int)
    bucket_actual: dict[date, int] = defaultdict(int)
    grand_total = 0

    for start, end, cid, mt in attributed:
        minutes = max(0, int((end - start).total_seconds() // 60))
        if minutes <= 0:
            continue
        bucket_start = bucketize(start)
        cust_entry = grouped[bucket_start][cid]
        cust_entry.minutes += minutes
        cust_entry.by_type[mt] = cust_entry.by_type.get(mt, 0) + minutes
        totals_customer[cid] += minutes
        totals_type[mt] += minutes
        bucket_actual[bucket_start] += minutes
        grand_total += minutes

    buckets_out: list[TimeBucket] = []
    for bucket_start in sorted(grouped.keys()):
        per_customer = grouped[bucket_start]
        breakdown = [
            CustomerBucketEntry(
                customer_id=cid,
                customer_name=name_for.get(cid, _humanize_customer_id(cid)),
                minutes=entry.minutes,
                by_type=dict(entry.by_type),
            )
            for cid, entry in sorted(
                per_customer.items(),
                key=lambda kv: kv[1].minutes,
                reverse=True,
            )
        ]
        # Bucket total = global union (deduplicates cross-customer overlap).
        total_minutes = bucket_actual.get(bucket_start, 0)
        buckets_out.append(
            TimeBucket(
                bucket_start=bucket_start.isoformat(),
                bucket_label=_format_label(bucket_start, bucket),
                customer_breakdown=breakdown,
                total_minutes=total_minutes,
            )
        )

    customer_totals_out = [
        CustomerTotal(
            customer_id=cid,
            customer_name=name_for.get(cid, _humanize_customer_id(cid)),
            minutes=mins,
        )
        for cid, mins in sorted(totals_customer.items(), key=lambda kv: kv[1], reverse=True)
    ]

    return TimeSpentResponse(
        buckets=buckets_out,
        totals_by_customer=customer_totals_out,
        totals_by_type=dict(totals_type),
        range_start=range_start.isoformat(),
        range_end=range_end.isoformat(),
        bucket=bucket,
        total_minutes=grand_total,
        event_count=counted_events,
    )


def _merge_intervals(
    intervals: list[tuple[datetime, datetime, str]],
) -> list[tuple[datetime, datetime, str]]:
    """Union overlapping (start, end, meeting_type) intervals.

    Within a merged span the meeting_type of the earliest-starting interval
    wins. This is a deliberate simplification: two overlapping meetings of
    different types within one customer are reported as the type that
    started first; the user's "actual" minutes are still correct.
    """
    if not intervals:
        return []
    sorted_iv = sorted(intervals, key=lambda x: (x[0], x[1]))
    merged: list[tuple[datetime, datetime, str]] = []
    cur_start, cur_end, cur_type = sorted_iv[0]
    for start, end, mt in sorted_iv[1:]:
        if start <= cur_end:
            if end > cur_end:
                cur_end = end
            # Keep the earliest type — `cur_type` already wins.
        else:
            merged.append((cur_start, cur_end, cur_type))
            cur_start, cur_end, cur_type = start, end, mt
    merged.append((cur_start, cur_end, cur_type))
    return merged


@dataclass
class _Aggregate:
    """In-memory accumulator: one row per (bucket, customer)."""

    minutes: int = 0
    by_type: dict[str, int] = field(default_factory=dict)
