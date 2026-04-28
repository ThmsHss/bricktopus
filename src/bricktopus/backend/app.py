import logging

from . import ontology_routes  # noqa: F401  # registers cache lifespan + routes
from .cache import create_db_and_tables, get_session
from .core import create_app
from .router import router
from .routes.calendar_events import router as calendar_events_router
from .routes.people import router as people_router
from .routes.plan_my_day import router as plan_my_day_router
from .routes.sources import router as sources_router
from .routes.time_spent import router as time_spent_router
from .services.attribution import seed_aliases

logger = logging.getLogger(__name__)

app = create_app(
    routers=[
        router,
        sources_router,
        time_spent_router,
        plan_my_day_router,
        people_router,
        calendar_events_router,
    ]
)


@app.on_event("startup")
async def _bootstrap_cache() -> None:
    """Create cache tables and seed customer aliases.

    The calendar/gmail/notion sync is *not* run here on purpose — with live
    Google credentials, syncing a year of events on every restart blows
    past the dev-server healthcheck timeout. Sync is now on-demand via
    POST /api/sources/sync/{source} and triggered from the UI.
    """
    create_db_and_tables()
    gen = get_session()
    session = next(gen)
    try:
        seed_aliases(session)
    finally:
        try:
            next(gen)
        except StopIteration:
            pass
