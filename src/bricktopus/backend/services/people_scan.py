"""Deterministic ontology scanner.

Walks the local cache (CalendarEvent + EmailThread) and upserts every
observed participant into OrgPerson via routes.people.upsert_person. The
upsert helper handles dedup, provenance merging, and domain/internal
flagging — this scanner only contributes the email + customer attribution.

No LLM calls. Names/titles/teams are left to upload pipelines (image,
gdoc, notion) that have richer source material.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlmodel import Session, select

from ..cache.people import OrgPerson
from ..cache.sources import CalendarEvent, EmailThread
from ..routes.people import OrgPersonUpsert, upsert_person
from .attribution import attribute

logger = logging.getLogger(__name__)


_DEFAULT_USER_EMAIL = "thomas.hass@databricks.com"


def _self_email() -> str:
    return os.environ.get("BRICKTOPUS_USER_EMAIL", _DEFAULT_USER_EMAIL).strip().lower()


@dataclass(frozen=True)
class ScanResult:
    """Counts emitted by a single scan run."""

    calendar_events_visited: int
    email_threads_visited: int
    persons_inserted: int
    persons_updated: int
    started_at: datetime
    finished_at: datetime


def _split_emails(csv: str) -> list[str]:
    """Lower-case, strip, drop empties, dedup while preserving order."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in (csv or "").split(","):
        email = raw.strip().lower()
        if not email or "@" not in email:
            continue
        if email in seen:
            continue
        seen.add(email)
        out.append(email)
    return out


def _customer_for(
    *,
    session: Session,
    title: str,
    email: str,
) -> Optional[str]:
    """Run the project's attribution rules with a single-attendee list so
    domain logic + INTERNAL bucket stay consistent across the codebase."""
    result = attribute(session=session, title=title, attendee_emails=[email])
    return result.customer_id if result else None


def _existing_emails(session: Session) -> set[str]:
    rows = session.exec(select(OrgPerson.email)).all()
    return {e.lower() for e in rows if e}


def _scan_emails(
    *,
    session: Session,
    title: str,
    emails: Iterable[str],
    source: str,
    self_email: str,
    known: set[str],
) -> tuple[int, int]:
    inserted = 0
    updated = 0
    for email in emails:
        if email == self_email:
            continue
        was_known = email in known
        customer_id = _customer_for(session=session, title=title, email=email)
        upsert_person(
            session,
            OrgPersonUpsert(
                email=email,
                customer_id=customer_id,
                source=source,
            ),
        )
        if was_known:
            updated += 1
        else:
            inserted += 1
            known.add(email)
    return inserted, updated


def scan_people(
    *,
    session: Session,
    since: Optional[datetime] = None,
) -> ScanResult:
    """Walk CalendarEvent + EmailThread rows since ``since`` (default: all
    rows in the cache) and upsert OrgPerson via the canonical helper.

    The scan is intentionally idempotent: running it twice with the same
    inputs only bumps ``last_seen_at`` and merges the provenance label,
    never duplicating rows.
    """
    started_at = datetime.now(tz=timezone.utc)
    self_email = _self_email()
    known = _existing_emails(session)

    persons_inserted = 0
    persons_updated = 0

    # ─── Calendar ───
    cal_stmt = select(CalendarEvent)
    if since is not None:
        cal_stmt = cal_stmt.where(CalendarEvent.starts_at >= since)
    events = session.exec(cal_stmt).all()
    for evt in events:
        emails = _split_emails(evt.attendee_emails)
        if evt.organizer_email:
            org = evt.organizer_email.strip().lower()
            if org and org not in emails:
                emails.append(org)
        ins, upd = _scan_emails(
            session=session,
            title=evt.summary or "",
            emails=emails,
            source="calendar_scan",
            self_email=self_email,
            known=known,
        )
        persons_inserted += ins
        persons_updated += upd

    # ─── Gmail ───
    mail_stmt = select(EmailThread)
    if since is not None:
        mail_stmt = mail_stmt.where(EmailThread.last_message_at >= since)
    threads = session.exec(mail_stmt).all()
    for thread in threads:
        emails = _split_emails(thread.participants)
        ins, upd = _scan_emails(
            session=session,
            title=thread.subject or "",
            emails=emails,
            source="gmail_scan",
            self_email=self_email,
            known=known,
        )
        persons_inserted += ins
        persons_updated += upd

    session.commit()
    finished_at = datetime.now(tz=timezone.utc)

    return ScanResult(
        calendar_events_visited=len(events),
        email_threads_visited=len(threads),
        persons_inserted=persons_inserted,
        persons_updated=persons_updated,
        started_at=started_at,
        finished_at=finished_at,
    )
