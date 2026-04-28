"""Notion page → plain text ingest.

Walks the block tree under a page (or any block id) and flattens the rich
text out of paragraphs, headings, and lists into a single string we hand
to the extractor. We deliberately skip child databases (too noisy for
people-extraction) and do not follow embedded synced blocks.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from ..mcp_clients import notion as notion_client

logger = logging.getLogger(__name__)

NOTION_API = notion_client.NOTION_API
NOTION_VERSION = notion_client.NOTION_VERSION

# UUID patterns: notion page ids are 32 hex chars, sometimes hyphenated.
_HEX32 = re.compile(r"([0-9a-fA-F]{32})")
_HYPHEN_UUID = re.compile(
    r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
)


def parse_page_id(url_or_id: str) -> str:
    """Extract a 32-char hex page id from a full Notion URL or accept a bare id.

    Accepts:
        - https://www.notion.so/Workspace/Page-Title-<32hex>
        - https://www.notion.so/<32hex>
        - 32-char hex
        - hyphenated uuid form (8-4-4-4-12)
    """
    if not url_or_id:
        raise ValueError("Empty Notion URL or id")
    candidate = url_or_id.strip()
    hyphen_match = _HYPHEN_UUID.search(candidate)
    if hyphen_match:
        return hyphen_match.group(1).replace("-", "")
    hex_match = _HEX32.search(candidate)
    if hex_match:
        return hex_match.group(1)
    raise ValueError(
        f"Could not parse a Notion page id from {url_or_id!r}. "
        "Expected a notion.so URL ending in a 32-char hex id."
    )


def fetch_page_plain_text(page_id: str) -> str:
    """Walk the page's block tree and return a single plain-text string.

    Raises RuntimeError if the integration token is missing.
    """
    token = notion_client._token()
    if not token:
        raise RuntimeError(
            "Notion not connected — paste a token in the sidebar Connect dialog."
        )

    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
    }
    chunks: list[str] = []
    with httpx.Client(timeout=30.0, headers=headers) as client:
        _walk_blocks(client, page_id, chunks)
    return "\n".join(c for c in chunks if c).strip()


# ────────── Internal walkers ──────────


def _walk_blocks(
    client: httpx.Client,
    block_id: str,
    out: list[str],
    *,
    depth: int = 0,
) -> None:
    # Defensive guard: Notion permits arbitrarily deep nesting; cap recursion.
    if depth > 10:
        return

    cursor: str | None = None
    while True:
        params: dict[str, Any] = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        resp = client.get(
            f"{NOTION_API}/blocks/{block_id}/children",
            params=params,
        )
        resp.raise_for_status()
        payload = resp.json()
        for block in payload.get("results", []):
            _emit_block_text(block, out)
            if block.get("has_children") and not _is_skippable_container(block):
                _walk_blocks(client, block["id"], out, depth=depth + 1)
        if not payload.get("has_more"):
            break
        cursor = payload.get("next_cursor")
        if not cursor:
            break


_TEXT_BLOCK_KINDS = {
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "to_do",
    "toggle",
    "quote",
    "callout",
}


def _emit_block_text(block: dict[str, Any], out: list[str]) -> None:
    kind = block.get("type")
    if kind not in _TEXT_BLOCK_KINDS:
        return
    payload = block.get(kind) or {}
    rich = payload.get("rich_text") or []
    text = _flatten_rich_text(rich)
    if not text:
        return
    if kind in {"bulleted_list_item", "numbered_list_item", "to_do"}:
        out.append(f"- {text}")
    elif kind in {"heading_1", "heading_2", "heading_3"}:
        out.append(f"\n{text}\n")
    else:
        out.append(text)


def _flatten_rich_text(rich: list[dict[str, Any]]) -> str:
    return "".join(item.get("plain_text") or "" for item in rich).strip()


def _is_skippable_container(block: dict[str, Any]) -> bool:
    """Skip embedded databases — too noisy for people extraction."""
    kind = block.get("type")
    return kind in {"child_database", "synced_block", "unsupported"}
