"""Rule-based meeting-type classifier.

Pure-Python regex table — no LLM. Output is one of a fixed vocabulary so
downstream UI and analytics can rely on a known set:

  discovery | demo | cadence | deep-dive | prep | admin | other

Order matters. Rules are checked top-down and the first match wins. `prep`
is intentionally checked before `cadence` so a self-organized "Puma prep"
block doesn't get bucketed as a recurring sync.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal

MeetingType = Literal[
    "discovery",
    "demo",
    "cadence",
    "deep-dive",
    "prep",
    "admin",
    "other",
]

INTERNAL_DOMAINS = frozenset({"databricks.com"})

# Compiled once at import. Each entry is (pattern, type, requires_external).
# `requires_external` lets us tighten cadence-style matches: a recurring
# weekly with no externals usually means an internal team standup, not a
# customer cadence — but we still classify it as "cadence" because that's
# the most useful bucket for time-spent. (The customer attribution layer
# already distinguishes internal vs. customer.)
_PREP_RE = re.compile(r"\b(prep|preparation)\b", re.IGNORECASE)
_DISCOVERY_RE = re.compile(
    r"\b(discovery|intro(?:duction)?|first[-\s]call|exploration)\b",
    re.IGNORECASE,
)
_DEMO_RE = re.compile(
    r"\b(demo|walkthrough|showcase|live[\s-]?demo)\b",
    re.IGNORECASE,
)
_CADENCE_RE = re.compile(
    r"\b(weekly|cadence|sync|status|standup|stand[-\s]up|qbr|"
    r"business[\s-]?review|check[-\s]?in)\b",
    re.IGNORECASE,
)
_DEEP_DIVE_RE = re.compile(
    r"\b(deep[-\s]?dive|architecture|workshop|best[\s-]?practice|"
    r"technical[\s-]?session|hands[-\s]?on)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class _Inputs:
    title: str
    description: str
    self_organized: bool
    has_external: bool
    has_internal: bool


def _email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].strip().lower() if "@" in email else ""


def _split_attendees(attendee_emails: Iterable[str]) -> tuple[bool, bool]:
    """Return (has_external, has_internal) flags for an attendee list."""
    has_external = False
    has_internal = False
    for raw in attendee_emails:
        domain = _email_domain(raw or "")
        if not domain:
            continue
        if domain in INTERNAL_DOMAINS:
            has_internal = True
        else:
            has_external = True
    return has_external, has_internal


def classify_meeting_type(
    title: str,
    attendee_emails: list[str],
    description: str | None,
    self_organized: bool,
) -> MeetingType:
    """Return the best meeting-type label for an event.

    Args:
        title: Event summary/title (the workhorse signal).
        attendee_emails: All attendee emails (internal + external).
        description: Free-text description; rarely decisive but a fallback.
        self_organized: Whether the event was created by the calendar owner.

    Returns:
        One of: discovery, demo, cadence, deep-dive, prep, other.
    """
    safe_title = title or ""
    safe_desc = description or ""
    haystack = f"{safe_title}\n{safe_desc}"
    has_external, _has_internal = _split_attendees(attendee_emails or [])

    # 1. prep — explicit "prep" / "preparation" in the title wins. A self-
    # organized "Puma prep" block lands here because of the regex; pure
    # self-organized blocks without "prep" fall to admin below.
    if _PREP_RE.search(safe_title):
        return "prep"

    # 2. discovery
    if _DISCOVERY_RE.search(haystack):
        return "discovery"

    # 3. demo
    if _DEMO_RE.search(haystack):
        return "demo"

    # 4. deep-dive — checked before cadence because a "weekly architecture
    #    workshop" is more usefully bucketed as deep-dive
    if _DEEP_DIVE_RE.search(haystack):
        return "deep-dive"

    # 5. cadence — only if it really has the recurring/sync feel
    if _CADENCE_RE.search(haystack):
        return "cadence"

    # 6. admin — self-organized blocks with no other category. Captures
    # personal work, focus time, summarize-the-day, travel, review-
    # consumption blocks, etc. Customer-attributed admin (e.g. "Puma
    # roadmap planning" you set up alone) still gets the customer label.
    if self_organized and not has_external:
        return "admin"

    return "other"


__all__ = ["MeetingType", "classify_meeting_type"]
