"""Canonical person records for the ontology.

Auto-scan (calendar + email) and manual upload pipelines both upsert into
this table. Each person is keyed on email (unique). Optional fields capture
title, team, manager_email, plus provenance — which source(s) created /
updated the row.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class OrgPerson(SQLModel, table=True):
    """A person (internal or external) we know about."""

    __tablename__ = "org_persons"

    email: str = Field(primary_key=True, index=True)
    name: Optional[str] = None
    title: Optional[str] = None
    team: Optional[str] = None
    manager_email: Optional[str] = Field(default=None, index=True)
    customer_id: Optional[str] = Field(default=None, index=True)
    domain: str = Field(index=True)
    is_internal: bool = False
    notes: Optional[str] = None
    linkedin_url: Optional[str] = None
    # Provenance: which sources have contributed; comma-separated for easy
    # appending. Examples: "calendar_scan", "gmail_scan", "image_upload",
    # "google_docs", "notion", "manual".
    sources: str = Field(default="")
    first_seen_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
    last_extracted_at: Optional[datetime] = None
    extraction_confidence: Optional[float] = None  # 0..1


class OrgExtraction(SQLModel, table=True):
    """Audit row per upload / scan run.

    Lets us re-run extractions, surface confidence, and undo an import if
    the user disagrees with what the LLM produced.
    """

    __tablename__ = "org_extractions"

    id: Optional[int] = Field(default=None, primary_key=True)
    source_type: str = Field(index=True)  # 'image', 'pdf', 'gdoc', 'notion', 'scan'
    source_label: Optional[str] = None  # filename / URL / human label
    customer_id: Optional[str] = Field(default=None, index=True)
    person_count: int = 0
    raw_response: Optional[str] = None  # JSON or text from LLM (audit)
    model: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
