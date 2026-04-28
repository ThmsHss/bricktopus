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

# Events with these response statuses count toward "time I actually spent".
# Treat None/empty as accepted — that's how mock data and most calendars
# represent self-organized blocks.
ACCEPTED_RESPONSES = frozenset({"accepted", "needsAction", None})

# Cap any single event at 4 hours. Real meetings rarely run that long;
# anything bigger is usually a focus block or a misused calendar entry.
MAX_MINUTES_PER_EVENT = 240

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

    # First pass: filter + collect raw intervals per (bucket, customer).
    # We'll union them later so two overlapping meetings on the same
    # day don't double-count.
    raw_intervals: dict[
        tuple[date, str], list[tuple[datetime, datetime, str]]
    ] = defaultdict(list)
    counted_events = 0

    bucketize = _week_start if bucket == "week" else _month_start

    for evt in events:
        if evt.duration_minutes <= 0:
            continue
        if evt.response_status not in ACCEPTED_RESPONSES:
            continue
        # All-day events are usually OOO / vacation / travel markers — they'd
        # add 24h per day if counted, blowing the weekly total past 168h.
        if evt.is_all_day:
            continue

        # Cap each event at MAX_MINUTES_PER_EVENT so a stray 12-hour block
        # doesn't dominate the chart.
        end = evt.starts_at + timedelta(
            minutes=min(evt.duration_minutes, MAX_MINUTES_PER_EVENT)
        )

        customer_id = evt.customer_id or "other"
        bucket_start = bucketize(evt.starts_at)
        meeting_type = evt.meeting_type or "other"
        raw_intervals[(bucket_start, customer_id)].append(
            (evt.starts_at, end, meeting_type)
        )
        counted_events += 1

    # Per-customer per-bucket: union overlapping intervals so two
    # back-to-back meetings on the same call don't double-count.
    grouped: dict[date, dict[str, _Aggregate]] = defaultdict(
        lambda: defaultdict(_Aggregate)
    )
    totals_customer: dict[str, int] = defaultdict(int)
    totals_type: dict[str, int] = defaultdict(int)

    for (bucket_start, customer_id), intervals in raw_intervals.items():
        merged = _merge_intervals(intervals)
        cust_entry = grouped[bucket_start][customer_id]
        for start, end, mt in merged:
            minutes = max(0, int((end - start).total_seconds() // 60))
            if minutes <= 0:
                continue
            cust_entry.minutes += minutes
            cust_entry.by_type[mt] = (
                cust_entry.by_type.get(mt, 0) + minutes
            )
            totals_customer[customer_id] += minutes
            totals_type[mt] += minutes

    # Headline / per-bucket totals: global union of all intervals (across
    # customers) so cross-customer overlap (rare but possible) doesn't
    # exceed reality. This is the "actual time" number; per-customer
    # totals above remain "scheduled time" so the breakdown still adds up
    # in the chart.
    bucket_actual: dict[date, int] = defaultdict(int)
    grand_total = 0
    all_by_bucket: dict[date, list[tuple[datetime, datetime, str]]] = defaultdict(list)
    for (bucket_start, _customer_id), intervals in raw_intervals.items():
        all_by_bucket[bucket_start].extend(intervals)
    for bucket_start, intervals in all_by_bucket.items():
        merged = _merge_intervals(intervals)
        minutes = sum(
            max(0, int((end - start).total_seconds() // 60))
            for start, end, _ in merged
        )
        bucket_actual[bucket_start] = minutes
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
