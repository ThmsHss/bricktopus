"""Time-spent aggregation endpoint.

Reads from the local calendar cache, groups by (bucket, customer, type),
and returns a structure ready for the Overview "Where I spend my time"
card. All times are kept in UTC at storage and bucketed in UTC; the UI
can convert to local TZ at the edge if it ever matters.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import select

from ..cache import session_dependency
from ..cache.sources import CalendarEvent, CustomerAlias

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/time-spent", tags=["time-spent"])

Bucket = Literal["week", "month"]

# Events with these response statuses count toward "time I actually spent".
# Treat None/empty as accepted — that's how mock data and most calendars
# represent self-organized blocks.
ACCEPTED_RESPONSES = frozenset({"accepted", "needsAction", None})

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
    default_start = date(today.year, 1, 1)
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

    # bucket_start (date) -> customer_id -> {"minutes": int, "by_type": {...}}
    grouped: dict[date, dict[str, dict[str, object]]] = defaultdict(lambda: defaultdict(_empty_entry))
    totals_customer: dict[str, int] = defaultdict(int)
    totals_type: dict[str, int] = defaultdict(int)
    grand_total = 0
    counted_events = 0

    bucketize = _week_start if bucket == "week" else _month_start

    for evt in events:
        if evt.customer_id is None:
            continue
        if evt.duration_minutes <= 0:
            continue
        if evt.response_status not in ACCEPTED_RESPONSES:
            continue

        bucket_start = bucketize(evt.starts_at)
        meeting_type = evt.meeting_type or "other"
        cust_entry = grouped[bucket_start][evt.customer_id]
        cust_entry["minutes"] = int(cust_entry["minutes"]) + evt.duration_minutes  # type: ignore[arg-type]
        by_type: dict[str, int] = cust_entry["by_type"]  # type: ignore[assignment]
        by_type[meeting_type] = by_type.get(meeting_type, 0) + evt.duration_minutes

        totals_customer[evt.customer_id] += evt.duration_minutes
        totals_type[meeting_type] += evt.duration_minutes
        grand_total += evt.duration_minutes
        counted_events += 1

    buckets_out: list[TimeBucket] = []
    for bucket_start in sorted(grouped.keys()):
        per_customer = grouped[bucket_start]
        breakdown = [
            CustomerBucketEntry(
                customer_id=cid,
                customer_name=name_for.get(cid, _humanize_customer_id(cid)),
                minutes=int(entry["minutes"]),  # type: ignore[arg-type]
                by_type=dict(entry["by_type"]),  # type: ignore[arg-type]
            )
            for cid, entry in sorted(
                per_customer.items(),
                key=lambda kv: int(kv[1]["minutes"]),  # type: ignore[arg-type]
                reverse=True,
            )
        ]
        total_minutes = sum(c.minutes for c in breakdown)
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


def _empty_entry() -> dict[str, object]:
    return {"minutes": 0, "by_type": {}}
