"""Canonical OrgPerson CRUD + upsert.

All ontology-build pipelines (calendar/mail scan, image upload,
docs ingest) write through this surface so dedup + provenance stays
consistent.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import select

from ..cache import session_dependency
from ..cache.people import OrgExtraction, OrgPerson
from ..services import secrets
from ..services.attribution import _email_domain, _is_internal
from ..services.llm import (
    ExtractedPerson,
    LLMNotConfigured,
    get_llm_client,
)

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


# ────────── Extraction (image / PDF upload) ──────────


# 10 MB cap for uploaded artifacts. Anthropic vision/document handling
# starts to lag well before this, but it gives users some headroom for
# multi-page PDFs. Larger files would have to be processed out-of-band.
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ExtractedPersonOut(BaseModel):
    """Single proposed person from an extraction call."""

    name: Optional[str]
    title: Optional[str]
    team: Optional[str]
    manager_name: Optional[str]
    email: Optional[str]
    confidence: float
    ready_to_upsert: bool


class ExtractionResponseOut(BaseModel):
    """End-to-end response for `/extract`.

    `committed` is the count actually persisted via ``upsert_person`` —
    zero unless the caller passed ``commit=true`` and the row had a
    valid email.
    """

    model: str
    people: list[ExtractedPersonOut]
    committed: int
    extraction_id: int


def _classify_kind(content_type: str) -> tuple[str, str]:
    """Map a multipart content-type to (kind, source_label).

    Returns (kind, source_tag) where source_tag is the value to feed
    `OrgPersonUpsert.source` so downstream attribution stays specific.
    """
    ctype = (content_type or "").lower().split(";", 1)[0].strip()
    if ctype == "application/pdf":
        return "pdf", "pdf_upload"
    if ctype.startswith("image/"):
        return "image", "image_upload"
    raise HTTPException(
        status_code=415,
        detail=(
            f"Unsupported file type {content_type!r}. "
            "Upload an image (image/*) or a PDF (application/pdf)."
        ),
    )


def _is_valid_email(value: Optional[str]) -> bool:
    if not value:
        return False
    return bool(_EMAIL_RE.match(value.strip()))


def _to_extracted_out(person: ExtractedPerson) -> ExtractedPersonOut:
    return ExtractedPersonOut(
        name=person.name,
        title=person.title,
        team=person.team,
        manager_name=person.manager_name,
        email=person.email,
        confidence=person.confidence,
        ready_to_upsert=_is_valid_email(person.email),
    )


@router.post(
    "/extract",
    response_model=ExtractionResponseOut,
    operation_id="extractPeopleFromUpload",
)
async def extract_people_from_upload(
    session: session_dependency,
    file: UploadFile = File(...),
    customer_id: Optional[str] = Form(default=None),
    commit: bool = Form(default=False),
) -> ExtractionResponseOut:
    """Extract people from an image or PDF upload.

    `commit=false` returns the proposed records for review; `commit=true`
    immediately upserts those with a valid email. Either way an
    `OrgExtraction` audit row is written.
    """
    raw = await file.read()
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File is too large ({len(raw)} bytes). "
                f"Limit is {_MAX_UPLOAD_BYTES} bytes (~10 MB)."
            ),
        )
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    kind, source_tag = _classify_kind(file.content_type or "")
    media_type = file.content_type or (
        "application/pdf" if kind == "pdf" else "image/png"
    )
    customer_hint = (customer_id or None) and customer_id.strip() or None

    client = get_llm_client()
    try:
        result = client.extract_people(
            kind=kind,
            content=raw,
            media_type=media_type,
            customer_hint=customer_hint,
        )
    except LLMNotConfigured as exc:
        # Make the remediation path explicit so the UI can route the
        # user straight to the Connect modal.
        raise HTTPException(
            status_code=503,
            detail={
                "message": str(exc),
                "remediation": "Connect an Anthropic API key.",
                "endpoint": "/api/ontology/llm-key",
            },
        ) from exc

    proposed = [_to_extracted_out(p) for p in result.people]

    committed = 0
    if commit:
        for person in result.people:
            if not _is_valid_email(person.email):
                continue
            assert person.email is not None  # narrowed by _is_valid_email
            upsert_person(
                session,
                OrgPersonUpsert(
                    email=person.email.strip().lower(),
                    name=person.name,
                    title=person.title,
                    team=person.team,
                    customer_id=customer_hint,
                    source=source_tag,
                    extraction_confidence=person.confidence,
                ),
            )
            committed += 1

    extraction = OrgExtraction(
        source_type=kind,
        source_label=file.filename,
        customer_id=customer_hint,
        person_count=len(result.people),
        raw_response=result.raw_response or None,
        model=result.model,
    )
    session.add(extraction)
    session.commit()
    session.refresh(extraction)

    assert extraction.id is not None  # populated by commit/refresh
    return ExtractionResponseOut(
        model=result.model,
        people=proposed,
        committed=committed,
        extraction_id=extraction.id,
    )
