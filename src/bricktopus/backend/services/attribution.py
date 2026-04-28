"""Customer attribution.

Given a calendar event / email / notion page, decide which customer (if any)
it belongs to. Two attribution strategies, applied in order:

1. **email_domain** — match any participant's email domain against the
   customer alias table. Internal Databricks events stay attributed to
   `internal` so we can break time spent into "internal vs. customer".
2. **title_regex** — fall back to title matching for self-prep blocks
   like "Puma prep" where there's no external attendee.

Designed deterministic — no LLM. The alias list is data, seeded into the
SQLite table on startup; new aliases can be added at runtime via API
(addressed in a follow-up).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Optional

from sqlmodel import Session, select

from ..cache.sources import CustomerAlias

INTERNAL_DOMAINS = frozenset({"databricks.com"})
INTERNAL_CUSTOMER_ID = "internal"
INTERNAL_CUSTOMER_NAME = "Internal · Databricks"


@dataclass(frozen=True)
class AttributionResult:
    customer_id: str
    customer_name: str
    matched_via: str  # "email_domain" | "title_regex" | "internal_default"
    matched_value: str  # the domain or pattern that matched


# ---------- Static seed list ----------
# Initial aliases known up-front. New customers are added via API later.
SEED_ALIASES: list[dict[str, str | int]] = [
    # PUMA
    {
        "customer_id": "puma",
        "customer_name": "PUMA",
        "match_kind": "email_domain",
        "pattern": "puma.com",
        "priority": 10,
    },
    {
        "customer_id": "puma",
        "customer_name": "PUMA",
        "match_kind": "title_regex",
        "pattern": r"\bpuma\b",
        "priority": 20,
    },
    # Grünenthal
    {
        "customer_id": "gruenenthal",
        "customer_name": "Grünenthal",
        "match_kind": "email_domain",
        "pattern": "grunenthal.com",
        "priority": 10,
    },
    {
        "customer_id": "gruenenthal",
        "customer_name": "Grünenthal",
        "match_kind": "title_regex",
        "pattern": r"\bgr(ü|ue)nenthal\b",
        "priority": 20,
    },
    # BioNTech
    {
        "customer_id": "biontech",
        "customer_name": "BioNTech",
        "match_kind": "email_domain",
        "pattern": "biontech.de",
        "priority": 10,
    },
    {
        "customer_id": "biontech",
        "customer_name": "BioNTech",
        "match_kind": "title_regex",
        "pattern": r"\bbiontech\b",
        "priority": 20,
    },
    # Beiersdorf
    {
        "customer_id": "beiersdorf",
        "customer_name": "Beiersdorf",
        "match_kind": "email_domain",
        "pattern": "beiersdorf.com",
        "priority": 10,
    },
    {
        "customer_id": "beiersdorf",
        "customer_name": "Beiersdorf",
        "match_kind": "title_regex",
        "pattern": r"\bbeiersdorf\b",
        "priority": 20,
    },
]


def seed_aliases(session: Session) -> int:
    """Insert seed aliases if missing. Returns rows added."""
    existing = {
        (a.customer_id, a.match_kind, a.pattern)
        for a in session.exec(select(CustomerAlias)).all()
    }
    added = 0
    for spec in SEED_ALIASES:
        key = (spec["customer_id"], spec["match_kind"], spec["pattern"])
        if key in existing:
            continue
        session.add(CustomerAlias(**spec))  # type: ignore[arg-type]
        added += 1
    if added:
        session.commit()
    return added


# ---------- Attribution logic ----------


def _email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].strip().lower() if "@" in email else ""


def _is_internal(domain: str) -> bool:
    return domain in INTERNAL_DOMAINS


def attribute(
    *,
    session: Session,
    title: str,
    attendee_emails: Iterable[str],
) -> Optional[AttributionResult]:
    """Return the best-matching customer, or None if uncertain.

    Order:
      1. Any non-internal attendee domain matches an email_domain alias.
      2. Title matches a title_regex alias (for self-prep blocks).
      3. Only internal attendees → INTERNAL bucket.
      4. Otherwise None (caller can bucket as "unknown").
    """
    aliases = sorted(
        session.exec(select(CustomerAlias)).all(),
        key=lambda a: (a.priority, a.id or 0),
    )
    domain_aliases = [a for a in aliases if a.match_kind == "email_domain"]
    title_aliases = [a for a in aliases if a.match_kind == "title_regex"]

    domains = [_email_domain(e) for e in attendee_emails if e]
    external_domains = [d for d in domains if d and not _is_internal(d)]

    # 1. external email domain match
    for alias in domain_aliases:
        for d in external_domains:
            if d == alias.pattern.lower():
                return AttributionResult(
                    customer_id=alias.customer_id,
                    customer_name=alias.customer_name,
                    matched_via="email_domain",
                    matched_value=alias.pattern,
                )

    # 2. title regex (covers self-prep blocks: "Puma prep")
    for alias in title_aliases:
        try:
            if re.search(alias.pattern, title, flags=re.IGNORECASE):
                return AttributionResult(
                    customer_id=alias.customer_id,
                    customer_name=alias.customer_name,
                    matched_via="title_regex",
                    matched_value=alias.pattern,
                )
        except re.error:
            continue

    # 3. Internal-only → bucketed as "internal"
    if domains and all(_is_internal(d) for d in domains):
        return AttributionResult(
            customer_id=INTERNAL_CUSTOMER_ID,
            customer_name=INTERNAL_CUSTOMER_NAME,
            matched_via="internal_default",
            matched_value="databricks.com",
        )

    return None
