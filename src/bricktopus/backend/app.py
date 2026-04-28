from . import ontology_routes  # noqa: F401  # registers cache lifespan + routes
from .core import create_app
from .router import router

app = create_app(routers=[router])
