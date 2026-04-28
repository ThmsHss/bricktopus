import logging
from datetime import date, datetime, timedelta, timezone

from . import ontology_routes  # noqa: F401  # registers cache lifespan + routes
from .cache import create_db_and_tables, get_session
from .core import create_app
from .mcp_clients import GoogleCalendarClient
from .router import router
from .routes.plan_my_day import router as plan_my_day_router
from .routes.sources import router as sources_router
from .routes.time_spent import router as time_spent_router
from .services.attribution import seed_aliases
from .sync import sync_calendar

logger = logging.getLogger(__name__)

app = create_app(
    routers=[router, sources_router, time_spent_router, plan_my_day_router]
)


@app.on_event("startup")
async def _bootstrap_cache() -> None:
    """Create cache tables, seed aliases, and prime the calendar cache."""
    create_db_and_tables()
    gen = get_session()
    session = next(gen)
    try:
        seed_aliases(session)
        try:
            today = datetime.now(tz=timezone.utc)
            year_start = datetime.combine(
                date(today.year, 1, 1), datetime.min.time(), tzinfo=timezone.utc
            )
            end_window = today + timedelta(days=30)
            res = sync_calendar(
                session=session,
                client=GoogleCalendarClient(),
                starts_after=year_start,
                starts_before=end_window,
            )
            logger.info(
                "Initial calendar sync complete: %s events (%s mode)",
                res.total,
                res.source_mode,
            )
        except Exception as exc:  # noqa: BLE001 — best-effort bootstrap
            logger.warning("Initial calendar sync skipped: %s", exc)
    finally:
        try:
            next(gen)
        except StopIteration:
            pass
