from .cache import create_db_and_tables, get_session
from .core import create_app
from .router import router
from .routes.sources import router as sources_router
from .services.attribution import seed_aliases

app = create_app(routers=[router, sources_router])


@app.on_event("startup")
async def _bootstrap_cache() -> None:
    """Create cache tables and seed customer aliases on startup."""
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
