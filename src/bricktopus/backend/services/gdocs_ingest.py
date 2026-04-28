"""Google Docs → plain text ingest.

Resolves a docs.google.com URL or raw doc id, then walks the document body
recursively to flatten paragraph + table text into a single string. We
deliberately drop images and structural metadata: the LLM extraction step
only needs the prose to find people.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from . import google_adc

logger = logging.getLogger(__name__)


# docs.google.com/document/d/<id>/edit, /document/u/0/d/<id>/, etc.
_DOC_ID_PATTERN = re.compile(r"/document/(?:u/\d+/)?d/([a-zA-Z0-9_-]+)")
# Bare doc id: 25–80 url-safe chars (Google ids vary, give a generous window).
_BARE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{20,}$")


def parse_doc_url(url: str) -> str:
    """Extract a Google Docs document id from a full URL or bare id."""
    if not url:
        raise ValueError("Empty Google Docs URL or id")
    candidate = url.strip()
    if _BARE_ID_PATTERN.match(candidate):
        return candidate
    match = _DOC_ID_PATTERN.search(candidate)
    if match:
        return match.group(1)
    raise ValueError(
        f"Could not parse a Google Docs id from {url!r}. "
        "Expected https://docs.google.com/document/d/<id>/... or a bare id."
    )


def fetch_doc_text(doc_id: str) -> str:
    """Fetch a Google Doc and return its body as a single plain-text string.

    Uses Application Default Credentials via `google_adc.build_service`.
    The caller surfaces upstream API errors as 502s.
    """
    service = google_adc.build_service("docs", "v1")
    document = service.documents().get(documentId=doc_id).execute()
    body = document.get("body") or {}
    chunks: list[str] = []
    _walk_content(body.get("content") or [], chunks)
    return "\n".join(c for c in chunks if c).strip()


# ────────── Internal walkers ──────────


def _walk_content(elements: list[dict[str, Any]], out: list[str]) -> None:
    for element in elements:
        if "paragraph" in element:
            text = _flatten_paragraph(element["paragraph"])
            if text:
                out.append(text)
        elif "table" in element:
            _walk_table(element["table"], out)
        elif "tableOfContents" in element:
            inner = element["tableOfContents"].get("content") or []
            _walk_content(inner, out)
        # Skip sectionBreak, image-only elements, etc.


def _flatten_paragraph(paragraph: dict[str, Any]) -> str:
    parts: list[str] = []
    for el in paragraph.get("elements") or []:
        text_run = el.get("textRun")
        if text_run:
            content = text_run.get("content") or ""
            if content:
                parts.append(content)
    # Preserve newlines from textRun content; collapse purely whitespace runs.
    joined = "".join(parts).rstrip("\n")
    return joined


def _walk_table(table: dict[str, Any], out: list[str]) -> None:
    for row in table.get("tableRows") or []:
        row_cells: list[str] = []
        for cell in row.get("tableCells") or []:
            cell_chunks: list[str] = []
            _walk_content(cell.get("content") or [], cell_chunks)
            cell_text = " ".join(c.strip() for c in cell_chunks if c.strip())
            if cell_text:
                row_cells.append(cell_text)
        if row_cells:
            out.append(" | ".join(row_cells))
