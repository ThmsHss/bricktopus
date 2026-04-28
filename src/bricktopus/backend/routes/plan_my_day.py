"""Plan-my-day API.

Returns the per-meeting briefing for `day` (default: today UTC) for the
configured user. Reads come from the SQLite cache only; if the calendar
cache is empty for the user we kick off a one-shot calendar sync inline
on a best-effort basis.
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Query
from sqlmodel import select

from ..cache import session_dependency
from ..cache.sources import CalendarEvent
from ..mcp_clients import GoogleCalendarClient
from ..services.daily_briefing import DailyBriefingOut, build_daily_briefing
from ..sync import sync_calendar

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plan-my-day", tags=["plan-my-day"])


def _resolve_user_email() -> str:
    return os.environ.get(
        "BRICKTOPUS_USER_EMAIL", "thomas.hass@databricks.com"
    )


def _ensure_calendar_seeded(session, user_email: str) -> None:
    """If the cache has no calendar rows for this user, run one sync.

    Best-effort: never raises. If the sync fails (e.g. no MCP / no creds)
    we just log and let the briefing render whatever we have.
    """
    has_any = session.exec(
        select(CalendarEvent.id)
        .where(CalendarEvent.user_email == user_email)
        .limit(1)
    ).first()
    if has_any:
        return

    logger.info(
        "calendar cache empty for %s — running inline sync", user_email
    )
    try:
        now = datetime.now(tz=timezone.utc)
        sync_calendar(
            session=session,
            client=GoogleCalendarClient(user_email=user_email),
            starts_after=now - timedelta(days=365),
            starts_before=now + timedelta(days=30),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("inline calendar sync failed: %s", exc)


@router.get(
    "",
    response_model=DailyBriefingOut,
    operation_id="getDailyBriefing",
)
def get_daily_briefing(
    session: session_dependency,
    day: Optional[date] = Query(
        default=None,
        description="Day to brief, ISO date (YYYY-MM-DD). Defaults to today UTC.",
    ),
) -> DailyBriefingOut:
    user_email = _resolve_user_email()
    _ensure_calendar_seeded(session, user_email)
    return build_daily_briefing(session, user_email=user_email, day=day)
