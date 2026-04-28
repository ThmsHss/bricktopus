"""Canonical OrgPerson CRUD + upsert.

All ontology-build pipelines (calendar/mail scan, image upload,
docs ingest) write through this surface so dedup + provenance stays
consistent.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import select

from ..cache import session_dependency
from ..cache.people import OrgExtraction, OrgPerson
from ..services import secrets
from ..services.attribution import _email_domain, _is_internal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ontology", tags=["ontology-people"])


# ────────── Schemas ──────────


class OrgPersonOut(BaseModel):
    email: str
    name: Optional[str]
    title: Optional[str]
    team: Optional[str]
    manager_email: Optional[str]
    customer_id: Optional[str]
    domain: str
    is_internal: bool
    notes: Optional[str]
    linkedin_url: Optional[str]
    sources: list[str]
    first_seen_at: datetime
    last_seen_at: datetime
    last_extracted_at: Optional[datetime]
    extraction_confidence: Optional[float]


class OrgPersonUpsert(BaseModel):
    email: str = Field(min_length=3)
    name: Optional[str] = None
    title: Optional[str] = None
    team: Optional[str] = None
    manager_email: Optional[str] = None
    customer_id: Optional[str] = None
    notes: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: str = Field(
        default="manual",
        description="Provenance label, e.g. calendar_scan / image_upload / manual",
    )
    extraction_confidence: Optional[float] = None


class OrgPersonListOut(BaseModel):
    persons: list[OrgPersonOut]
    total: int


# ────────── Helpers ──────────


def _to_out(p: OrgPerson) -> OrgPersonOut:
    return OrgPersonOut(
        email=p.email,
        name=p.name,
        title=p.title,
        team=p.team,
        manager_email=p.manager_email,
        customer_id=p.customer_id,
        domain=p.domain,
        is_internal=p.is_internal,
        notes=p.notes,
        linkedin_url=p.linkedin_url,
        sources=[s for s in (p.sources or "").split(",") if s],
        first_seen_at=p.first_seen_at,
        last_seen_at=p.last_seen_at,
        last_extracted_at=p.last_extracted_at,
        extraction_confidence=p.extraction_confidence,
    )


def _merge_sources(existing: str, new: str) -> str:
    parts = [s.strip() for s in (existing or "").split(",") if s.strip()]
    if new and new not in parts:
        parts.append(new)
    return ",".join(parts)


def upsert_person(session, body: OrgPersonUpsert) -> OrgPerson:  # noqa: ANN001
    """Idempotent upsert keyed on email. Used by all ingest pipelines."""
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail=f"Invalid email: {email!r}")

    domain = _email_domain(email)
    is_internal = _is_internal(domain)
    now = datetime.now(tz=timezone.utc)

    existing = session.get(OrgPerson, email)
    if existing is None:
        person = OrgPerson(
            email=email,
            name=body.name,
            title=body.title,
            team=body.team,
            manager_email=(body.manager_email or "").lower() or None,
            customer_id=body.customer_id,
            domain=domain,
            is_internal=is_internal,
            notes=body.notes,
            linkedin_url=body.linkedin_url,
            sources=body.source or "manual",
            first_seen_at=now,
            last_seen_at=now,
            last_extracted_at=now if body.source != "manual" else None,
            extraction_confidence=body.extraction_confidence,
        )
        session.add(person)
        return person

    # Merge: never erase fields with null; bump last_seen + sources.
    existing.last_seen_at = now
    existing.sources = _merge_sources(existing.sources, body.source)
    existing.is_internal = is_internal
    existing.domain = domain
    if body.name and not existing.name:
        existing.name = body.name
    if body.title and not existing.title:
        existing.title = body.title
    if body.team and not existing.team:
        existing.team = body.team
    if body.manager_email and not existing.manager_email:
        existing.manager_email = body.manager_email.lower()
    if body.customer_id and not existing.customer_id:
        existing.customer_id = body.customer_id
    if body.notes:
        existing.notes = body.notes
    if body.linkedin_url and not existing.linkedin_url:
        existing.linkedin_url = body.linkedin_url
    if body.source != "manual":
        existing.last_extracted_at = now
    if body.extraction_confidence is not None:
        existing.extraction_confidence = body.extraction_confidence
    session.add(existing)
    return existing


# ────────── Routes ──────────


@router.get(
    "/persons",
    response_model=OrgPersonListOut,
    operation_id="listOrgPersons",
)
def list_persons(
    session: session_dependency,
    customer_id: Optional[str] = None,
    include_internal: bool = True,
) -> OrgPersonListOut:
    stmt = select(OrgPerson).order_by(OrgPerson.last_seen_at.desc())
    if customer_id:
        stmt = stmt.where(OrgPerson.customer_id == customer_id)
    if not include_internal:
        stmt = stmt.where(OrgPerson.is_internal == False)  # noqa: E712
    rows = session.exec(stmt).all()
    return OrgPersonListOut(
        persons=[_to_out(p) for p in rows],
        total=len(rows),
    )


@router.put(
    "/persons",
    response_model=OrgPersonOut,
    operation_id="upsertOrgPerson",
)
def upsert_person_route(
    session: session_dependency,
    body: OrgPersonUpsert,
) -> OrgPersonOut:
    person = upsert_person(session, body)
    session.commit()
    session.refresh(person)
    return _to_out(person)


@router.delete(
    "/persons/{email}",
    operation_id="deleteOrgPerson",
)
def delete_person(
    session: session_dependency,
    email: str,
) -> dict[str, bool]:
    person = session.get(OrgPerson, email.lower())
    if person is None:
        raise HTTPException(status_code=404, detail=f"No person {email!r}")
    session.delete(person)
    session.commit()
    return {"ok": True}


# ────────── LLM key connect ──────────


class LLMKeyIn(BaseModel):
    api_key: str = Field(min_length=10)


class LLMKeyOut(BaseModel):
    ok: bool
    detail: str


@router.post(
    "/llm-key",
    response_model=LLMKeyOut,
    operation_id="connectLlmKey",
)
def connect_llm_key(body: LLMKeyIn) -> LLMKeyOut:
    secrets.set_value("anthropic_api_key", body.api_key.strip())
    return LLMKeyOut(ok=True, detail="Anthropic API key saved.")


@router.delete(
    "/llm-key",
    response_model=LLMKeyOut,
    operation_id="disconnectLlmKey",
)
def disconnect_llm_key() -> LLMKeyOut:
    removed = secrets.delete("anthropic_api_key")
    return LLMKeyOut(
        ok=removed,
        detail="API key removed." if removed else "Nothing to remove.",
    )


@router.get(
    "/llm-status",
    operation_id="llmStatus",
)
def llm_status() -> dict[str, object]:
    from ..services.llm import _DEFAULT_MODEL, is_configured

    return {
        "configured": is_configured(),
        "model": _DEFAULT_MODEL,
    }


# ────────── Doc-URL ingest (Google Docs / Notion) ──────────


class IngestDocIn(BaseModel):
    kind: str = Field(description="'gdoc' | 'notion'")
    url_or_id: str = Field(min_length=3)
    customer_id: Optional[str] = None
    commit: bool = False


class IngestedPersonOut(BaseModel):
    name: Optional[str]
    title: Optional[str]
    team: Optional[str]
    manager_name: Optional[str]
    email: Optional[str]
    confidence: float
    ready_to_upsert: bool


class IngestDocOut(BaseModel):
    model: str
    doc_chars: int
    people: list[IngestedPersonOut]
    committed: int
    extraction_id: int


@router.post(
    "/ingest-doc",
    response_model=IngestDocOut,
    operation_id="ingestDoc",
)
def ingest_doc(
    session: session_dependency,
    body: IngestDocIn,
) -> IngestDocOut:
    """Resolve URL/id → fetch text → extract people → optional upsert.

    `commit=False` (default) is a dry-run: returns the LLM's people list
    plus an audit row, without touching `org_persons`. The frontend uses
    this two-step pattern for the review-before-save UX.
    """
    from ..services import gdocs_ingest, notion_ingest
    from ..services.llm import LLMNotConfigured, get_llm_client

    kind = (body.kind or "").strip().lower()
    if kind not in {"gdoc", "notion"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported kind {body.kind!r} (expected 'gdoc' or 'notion').",
        )

    # 1. Resolve doc id.
    try:
        if kind == "gdoc":
            doc_id = gdocs_ingest.parse_doc_url(body.url_or_id)
        else:
            doc_id = notion_ingest.parse_page_id(body.url_or_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # 2. Fetch plain text.
    try:
        if kind == "gdoc":
            text = gdocs_ingest.fetch_doc_text(doc_id)
        else:
            text = notion_ingest.fetch_page_plain_text(doc_id)
    except RuntimeError as exc:
        # Notion-not-connected / ADC-missing → 502 with the original message.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - upstream errors are opaque
        raise HTTPException(
            status_code=502,
            detail=f"Upstream {kind} fetch failed: {exc}",
        ) from exc

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Document fetched but contains no plain text.",
        )

    # 3. Run extraction.
    try:
        client = get_llm_client()
        result = client.extract_people(
            kind="text",
            content=text,
            customer_hint=body.customer_id,
        )
    except LLMNotConfigured as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"{exc} Connect a key at /api/ontology/llm-key."
            ),
        ) from exc

    # 4. Persist audit row immediately (always, even on dry-run).
    extraction = OrgExtraction(
        source_type=kind,
        source_label=body.url_or_id,
        customer_id=body.customer_id,
        person_count=len(result.people),
        raw_response=result.raw_response,
        model=result.model,
    )
    session.add(extraction)
    session.flush()  # assign the PK so we can return it

    # 5. Optionally commit each candidate person.
    source_label = "google_docs" if kind == "gdoc" else "notion"
    committed = 0
    people_out: list[IngestedPersonOut] = []
    for person in result.people:
        ready = bool(person.email and "@" in (person.email or ""))
        if body.commit and ready:
            upsert_person(
                session,
                OrgPersonUpsert(
                    email=person.email or "",
                    name=person.name,
                    title=person.title,
                    team=person.team,
                    customer_id=body.customer_id,
                    source=source_label,
                    extraction_confidence=person.confidence,
                ),
            )
            committed += 1
        people_out.append(
            IngestedPersonOut(
                name=person.name,
                title=person.title,
                team=person.team,
                manager_name=person.manager_name,
                email=person.email,
                confidence=person.confidence,
                ready_to_upsert=ready,
            )
        )

    session.commit()

    return IngestDocOut(
        model=result.model,
        doc_chars=len(text),
        people=people_out,
        committed=committed,
        extraction_id=extraction.id or 0,
    )
