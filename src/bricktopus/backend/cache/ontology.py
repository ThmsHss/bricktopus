"""Cache table for ontology classifications.

Stores the user's manual classification of an `OrgPerson` for a given customer.
This is the canonical source of truth — UI overlays the mapping returned by this
table on top of the persona-derived fallback baked into the mock fixture.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


# Allowed classification values (mirrored on the frontend).
PERSON_CLASSIFICATIONS = ("champion", "supportive", "blocking")


class PersonClassification(SQLModel, table=True):
    """Manual classification of a person within a customer ontology."""

    __tablename__ = "person_classifications"

    person_id: str = Field(primary_key=True, description="OrgPerson.id")
    customer_id: str = Field(
        index=True, description="Customer namespace, e.g. 'puma'"
    )
    classification: str = Field(
        description="One of: champion | supportive | blocking",
    )
    updated_at: datetime = Field(default_factory=datetime.utcnow)
