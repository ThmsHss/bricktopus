"""LLM client for ontology extraction.

Designed so the implementation can swap (Anthropic now, Databricks
Foundation Models later) without changing call sites. Each call returns
JSON-shaped people records the cache can upsert directly.

API key resolution order:
1. ANTHROPIC_API_KEY env var
2. ~/.bricktopus/secrets.json key 'anthropic_api_key'

If neither is set, `extract_people` raises LLMNotConfigured. The Connect
flow surfaces a "Paste your Anthropic API key" form for that case.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from dataclasses import dataclass
from typing import Iterable, Literal, Optional, Protocol

from . import secrets

logger = logging.getLogger(__name__)


class LLMNotConfigured(RuntimeError):
    """Raised when no LLM credentials are available."""


@dataclass(frozen=True)
class ExtractedPerson:
    """A single person record produced by an extraction call."""

    name: Optional[str]
    title: Optional[str]
    team: Optional[str]
    manager_name: Optional[str]
    email: Optional[str]
    confidence: float


@dataclass(frozen=True)
class ExtractionResult:
    """Outcome of an extraction call."""

    people: list[ExtractedPerson]
    model: str
    raw_response: str


SourceKind = Literal["image", "pdf", "text"]


class LLMClient(Protocol):
    """Single seam for ontology extraction calls."""

    def extract_people(
        self,
        *,
        kind: SourceKind,
        content: bytes | str,
        media_type: Optional[str] = None,
        customer_hint: Optional[str] = None,
    ) -> ExtractionResult: ...


# ────────── Implementation: Anthropic Claude ──────────


_DEFAULT_MODEL = os.environ.get(
    "BRICKTOPUS_LLM_MODEL", "claude-sonnet-4-5-20250929"
)


_EXTRACT_SYSTEM = (
    "You extract structured people data from screenshots, org charts, "
    "documents, and free-text notes. You ONLY return a JSON object with a "
    "single key 'people' whose value is a list. Each person item has: name "
    "(string), title (string|null), team (string|null), manager_name "
    "(string|null), email (string|null), confidence (0..1). If you cannot "
    "find any people, return {\"people\": []}. Never invent emails."
)


def get_api_key() -> Optional[str]:
    return secrets.get("anthropic_api_key", env_var="ANTHROPIC_API_KEY")


def is_configured() -> bool:
    return get_api_key() is not None


class AnthropicLLMClient:
    """Anthropic Claude client. Uses the Messages API with vision."""

    def __init__(self, *, model: str = _DEFAULT_MODEL) -> None:
        self.model = model

    def extract_people(
        self,
        *,
        kind: SourceKind,
        content: bytes | str,
        media_type: Optional[str] = None,
        customer_hint: Optional[str] = None,
    ) -> ExtractionResult:
        from anthropic import Anthropic

        api_key = get_api_key()
        if not api_key:
            raise LLMNotConfigured(
                "ANTHROPIC_API_KEY is not configured. Paste your key in the "
                "Sources → AI model Connect dialog or set the env var."
            )

        hint = (
            f"Context: this content describes the org at customer "
            f"`{customer_hint}`. Prefer that as the company. "
            if customer_hint
            else ""
        )
        instructions = (
            f"{hint}Extract every person you can identify. Return JSON only."
        )

        if kind == "image":
            if not isinstance(content, (bytes, bytearray)):
                raise TypeError("image kind requires bytes content")
            blocks: list[dict] = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type or "image/png",
                        "data": base64.b64encode(content).decode("ascii"),
                    },
                },
                {"type": "text", "text": instructions},
            ]
        elif kind == "pdf":
            if not isinstance(content, (bytes, bytearray)):
                raise TypeError("pdf kind requires bytes content")
            blocks = [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": base64.b64encode(content).decode("ascii"),
                    },
                },
                {"type": "text", "text": instructions},
            ]
        else:
            text = content if isinstance(content, str) else content.decode("utf-8", "replace")
            blocks = [{"type": "text", "text": f"{instructions}\n\n{text}"}]

        client = Anthropic(api_key=api_key)
        msg = client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=_EXTRACT_SYSTEM,
            messages=[{"role": "user", "content": blocks}],
        )

        raw = "\n".join(
            block.text for block in msg.content if getattr(block, "type", None) == "text"
        )
        people = _parse_people_json(raw)

        return ExtractionResult(people=people, model=self.model, raw_response=raw)


# ────────── Implementation: stub for tests / no-key dev ──────────


class StubLLMClient:
    """Returns an empty list. Lets call sites work end-to-end without a key."""

    def extract_people(
        self,
        *,
        kind: SourceKind,  # noqa: ARG002
        content: bytes | str,  # noqa: ARG002
        media_type: Optional[str] = None,  # noqa: ARG002
        customer_hint: Optional[str] = None,  # noqa: ARG002
    ) -> ExtractionResult:
        return ExtractionResult(people=[], model="stub", raw_response="")


def get_llm_client() -> LLMClient:
    if is_configured():
        return AnthropicLLMClient()
    return StubLLMClient()


# ────────── helpers ──────────


def _parse_people_json(raw: str) -> list[ExtractedPerson]:
    text = raw.strip()
    # Tolerate models that wrap output in code fences.
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON; treating as no people")
        return []

    items: Iterable[dict] = []
    if isinstance(data, dict) and isinstance(data.get("people"), list):
        items = data["people"]
    elif isinstance(data, list):
        items = data
    else:
        return []

    out: list[ExtractedPerson] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            confidence = float(item.get("confidence") or 0.5)
        except (TypeError, ValueError):
            confidence = 0.5
        out.append(
            ExtractedPerson(
                name=_str_or_none(item.get("name")),
                title=_str_or_none(item.get("title")),
                team=_str_or_none(item.get("team")),
                manager_name=_str_or_none(item.get("manager_name")),
                email=_str_or_none(item.get("email")),
                confidence=max(0.0, min(1.0, confidence)),
            )
        )
    return out


def _str_or_none(value: object) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s or None
