"""Gmail wrapper. ADC-backed when gcloud credentials are available."""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from ..services import google_adc
from .base import EmailThreadDTO, SourceMode, SourceStatus

logger = logging.getLogger(__name__)


def _has_oauth() -> bool:
    if os.environ.get("BRICKTOPUS_GMAIL_FORCE_MOCK") == "1":
        return False
    return google_adc.adc_present()


class GmailClient:
    name = "gmail"

    def __init__(self, *, user_email: str | None = None) -> None:
        self.user_email = (
            user_email
            or google_adc.adc_email()
            or os.environ.get("BRICKTOPUS_USER_EMAIL")
            or "thomas.hass@databricks.com"
        )

    def status(self) -> SourceStatus:
        live = _has_oauth()
        return SourceStatus(
            name=self.name,
            mode=SourceMode.LIVE if live else SourceMode.MOCK,
            authenticated=live,
            detail=(
                f"Live: gcloud ADC for {self.user_email}."
                if live
                else "Run `gcloud auth application-default login` to switch to live mode."
            ),
        )

    def list_threads(
        self,
        *,
        modified_after: datetime,
        max_results: int = 250,
        with_email: Optional[str] = None,
    ) -> list[EmailThreadDTO]:
        if _has_oauth():
            return _live_threads(
                user_email=self.user_email,
                modified_after=modified_after,
                with_email=with_email,
                max_results=max_results,
            )
        return _mock_threads(
            user_email=self.user_email,
            modified_after=modified_after,
            with_email=with_email,
            max_results=max_results,
        )


# ---------- Live (Application Default Credentials) ----------

_EMAIL_RE = re.compile(r"<([^>]+)>")


def _live_threads(
    *,
    user_email: str,
    modified_after: datetime,
    with_email: Optional[str],
    max_results: int,
) -> list[EmailThreadDTO]:
    service = google_adc.build_service("gmail", "v1")

    after_epoch = int(modified_after.timestamp())
    query_parts = [f"after:{after_epoch}"]
    if with_email:
        query_parts.append(f"({{from:{with_email} OR to:{with_email}}})")
    query = " ".join(query_parts)

    out: list[EmailThreadDTO] = []
    page_token: Optional[str] = None
    remaining = max_results

    while remaining > 0:
        resp = (
            service.users()
            .threads()
            .list(
                userId="me",
                q=query,
                maxResults=min(remaining, 100),
                pageToken=page_token,
            )
            .execute()
        )
        for thread_meta in resp.get("threads", []):
            tid = thread_meta["id"]
            try:
                detail = (
                    service.users()
                    .threads()
                    .get(userId="me", id=tid, format="metadata",
                         metadataHeaders=["Subject", "From", "To", "Cc", "Date"])
                    .execute()
                )
            except Exception as exc:  # pragma: no cover
                logger.warning("Could not fetch gmail thread %s: %s", tid, exc)
                continue
            dto = _parse_thread(detail, user_email=user_email)
            if dto is not None:
                out.append(dto)
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
        remaining = max_results - len(out)

    return out


def _parse_thread(detail: dict, *, user_email: str) -> Optional[EmailThreadDTO]:
    messages = detail.get("messages") or []
    if not messages:
        return None

    first = messages[0]
    last = messages[-1]
    headers = {h["name"]: h["value"] for h in (first.get("payload") or {}).get("headers", [])}
    last_headers = {h["name"]: h["value"] for h in (last.get("payload") or {}).get("headers", [])}

    subject = headers.get("Subject") or "(no subject)"

    participants: set[str] = set()
    for m in messages:
        for h in (m.get("payload") or {}).get("headers", []):
            if h["name"] in {"From", "To", "Cc"}:
                for raw in str(h["value"]).split(","):
                    email = _extract_email(raw)
                    if email:
                        participants.add(email.lower())

    label_ids: set[str] = set()
    for m in messages:
        for label in m.get("labelIds") or []:
            label_ids.add(label)

    last_at = _parse_internal_date(last.get("internalDate")) or datetime.now(
        tz=timezone.utc
    )
    if "Date" in last_headers:
        try:
            from email.utils import parsedate_to_datetime

            parsed = parsedate_to_datetime(last_headers["Date"])
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            last_at = parsed
        except (TypeError, ValueError):
            pass

    return EmailThreadDTO(
        id=detail["id"],
        user_email=user_email,
        subject=subject,
        snippet=first.get("snippet"),
        participants=sorted(participants),
        last_message_at=last_at,
        message_count=len(messages),
        label_ids=sorted(label_ids),
    )


def _extract_email(raw: str) -> Optional[str]:
    raw = raw.strip()
    if not raw:
        return None
    match = _EMAIL_RE.search(raw)
    if match:
        return match.group(1).strip()
    return raw if "@" in raw else None


def _parse_internal_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (TypeError, ValueError):
        return None


def _mock_threads(
    *,
    user_email: str,
    modified_after: datetime,
    with_email: Optional[str],
    max_results: int,
) -> list[EmailThreadDTO]:
    base = datetime.now(tz=timezone.utc)
    samples: list[tuple[str, str, list[str], int, int]] = [
        (
            "Re: PUMA — Lakebase POC scoping",
            "Following up on the catalog cache discussion. Sharing the architecture brief.",
            ["felix.hoffmann@puma.com", user_email, "marco.rossi@databricks.com"],
            6,
            1,
        ),
        (
            "PUMA QBR agenda — May",
            "Sketch of QBR agenda. Need to confirm CFO attendance.",
            ["anna.mueller@databricks.com", user_email],
            3,
            3,
        ),
        (
            "BioNTech — clinical data platform follow-up",
            "Notes from the discovery call + open questions on regulatory scope.",
            ["mira.koch@biontech.de", user_email],
            5,
            2,
        ),
        (
            "Grünenthal — UC governance walkthrough",
            "Sharing the UC best-practices deck + an opinion on lakebase rollout.",
            ["sven.fischer@grunenthal.com", user_email,
             "marco.rossi@databricks.com"],
            4,
            4,
        ),
        (
            "Beiersdorf — Genie marketing demo recap",
            "Recap and the three suggested follow-ups from the marketing team.",
            ["jan.becker@beiersdorf.com", user_email],
            3,
            6,
        ),
        (
            "FE planning — Q3 priorities",
            "Internal planning thread.",
            ["regional-leads@databricks.com", user_email],
            12,
            2,
        ),
    ]

    out: list[EmailThreadDTO] = []
    for i, (subject, snippet, parts, count, days_ago) in enumerate(
        samples[:max_results]
    ):
        last = base - timedelta(days=days_ago)
        if last < modified_after:
            continue
        if with_email and with_email.lower() not in [p.lower() for p in parts]:
            continue
        out.append(
            EmailThreadDTO(
                id=f"mock-thread-{i:03d}",
                user_email=user_email,
                subject=subject,
                snippet=snippet,
                participants=parts,
                last_message_at=last,
                message_count=count,
                label_ids=["INBOX"],
            )
        )
    return out
