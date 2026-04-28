"""HTTP routes for ontology classification persistence.

Wraps the `PersonClassification` cache table behind two endpoints:

- `GET  /api/ontology/classifications?customer_id=puma` — full mapping
- `PUT  /api/ontology/classifications/{person_id}`      — upsert / clear

Init is wired through a `LifespanDependency` so tables are created on
application startup; the dependency itself contributes the routes via
`get_routers`.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncGenerator, Literal

from fastapi import APIRouter, FastAPI, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import select

from .cache import create_db_and_tables, session_dependency
from .cache.ontology import PERSON_CLASSIFICATIONS, PersonClassification
from .core import logger
from .core._base import LifespanDependency

Classification = Literal["champion", "supportive", "blocking"]


class ClassificationUpsert(BaseModel):
    """Request body for `PUT /ontology/classifications/{person_id}`."""

    customer_id: str
    classification: Classification | None


class ClassificationOut(BaseModel):
    """Response shape for a single classification."""

    person_id: str
    customer_id: str
    classification: Classification
    updated_at: datetime


def _validate_classification(value: str | None) -> str | None:
    if value is None:
        return None
    if value not in PERSON_CLASSIFICATIONS:
        allowed = ", ".join(PERSON_CLASSIFICATIONS)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"classification must be one of: {allowed} (or null)",
        )
    return value


def _build_router() -> APIRouter:
    router = APIRouter(prefix="/ontology", tags=["ontology"])

    @router.get(
        "/classifications",
        response_model=dict[str, str],
        operation_id="listOntologyClassifications",
    )
    def list_classifications(
        session: session_dependency,
        customer_id: str = Query(..., min_length=1),
    ) -> dict[str, str]:
        """Return `{person_id: classification}` for the given customer."""
        rows = session.exec(
            select(PersonClassification).where(
                PersonClassification.customer_id == customer_id
            )
        ).all()
        return {r.person_id: r.classification for r in rows}

    @router.put(
        "/classifications/{person_id}",
        response_model=ClassificationOut | None,
        operation_id="upsertOntologyClassification",
    )
    def upsert_classification(
        person_id: str,
        body: ClassificationUpsert,
        session: session_dependency,
    ) -> ClassificationOut | None:
        """Create / update / clear a classification for `person_id`."""
        if not body.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="customer_id is required",
            )
        cls = _validate_classification(body.classification)

        existing = session.get(PersonClassification, person_id)

        if cls is None:
            if existing is not None:
                session.delete(existing)
                session.commit()
            return None

        if existing is None:
            row = PersonClassification(
                person_id=person_id,
                customer_id=body.customer_id,
                classification=cls,
                updated_at=datetime.utcnow(),
            )
            session.add(row)
        else:
            # Immutable update pattern: replace fields explicitly, then persist.
            existing.customer_id = body.customer_id
            existing.classification = cls
            existing.updated_at = datetime.utcnow()
            row = existing
            session.add(row)

        session.commit()
        session.refresh(row)
        return ClassificationOut(
            person_id=row.person_id,
            customer_id=row.customer_id,
            classification=row.classification,  # type: ignore[arg-type]
            updated_at=row.updated_at,
        )

    return router


_ontology_router = _build_router()


class _OntologyCacheLifespan(LifespanDependency):
    """Initialize the SQLite cache and register ontology routes."""

    @asynccontextmanager
    async def lifespan(self, app: FastAPI) -> AsyncGenerator[None, None]:
        try:
            create_db_and_tables()
            logger.info("Ontology cache DB initialized")
        except Exception as exc:  # pragma: no cover - surfaced in logs
            logger.error(f"Failed to initialize ontology cache DB: {exc}")
            raise
        yield

    @staticmethod
    def __call__() -> None:  # pragma: no cover - dependency-only
        return None

    def get_routers(self) -> list[APIRouter]:
        return [_ontology_router]
