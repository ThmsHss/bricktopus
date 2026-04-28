"""Gmail wrapper. Mock-backed until the claude.ai Gmail MCP is authenticated."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from .base import EmailThreadDTO, SourceMode, SourceStatus


def _has_oauth() -> bool:
    return os.environ.get("BRICKTOPUS_GMAIL_AUTHENTICATED") == "1"


class GmailClient:
    name = "gmail"

    def __init__(self, *, user_email: str | None = None) -> None:
        self.user_email = user_email or os.environ.get(
            "BRICKTOPUS_USER_EMAIL", "thomas.hass@databricks.com"
        )

    def status(self) -> SourceStatus:
        live = _has_oauth()
        return SourceStatus(
            name=self.name,
            mode=SourceMode.LIVE if live else SourceMode.MOCK,
            authenticated=live,
            detail=(
                "Gmail MCP authenticated."
                if live
                else "Gmail MCP not authenticated yet — using mock fixtures."
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
            raise NotImplementedError(
                "Gmail MCP live calls not yet wired — implement once OAuth completes."
            )
        return _mock_threads(
            user_email=self.user_email,
            modified_after=modified_after,
            with_email=with_email,
            max_results=max_results,
        )


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
