"""File-backed secret store for source credentials.

The app's backend needs to read connection tokens (Notion integration token,
Salesforce credentials, etc.) without putting them on the filesystem next to
the source. We store them under ~/.bricktopus/secrets.json with 0600 perms.

Env vars still win — lets ops/CI override without rewriting the file.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_SECRETS_PATH = Path(
    os.environ.get(
        "BRICKTOPUS_SECRETS_FILE",
        str(Path.home() / ".bricktopus" / "secrets.json"),
    )
)


def _ensure_dir() -> None:
    _SECRETS_PATH.parent.mkdir(parents=True, exist_ok=True)


def _read_all() -> dict[str, Any]:
    if not _SECRETS_PATH.exists():
        return {}
    try:
        with _SECRETS_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not read secrets file: %s", exc)
        return {}


def _write_all(data: dict[str, Any]) -> None:
    _ensure_dir()
    tmp = _SECRETS_PATH.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, _SECRETS_PATH)


def get(key: str, *, env_var: Optional[str] = None) -> Optional[str]:
    """Resolve a secret. Env var wins; file is fallback."""
    if env_var:
        env_val = os.environ.get(env_var)
        if env_val:
            return env_val.strip()
    data = _read_all()
    val = data.get(key)
    return val.strip() if isinstance(val, str) and val.strip() else None


def get_dict(key: str) -> Optional[dict[str, Any]]:
    """Resolve a secret stored as a dict (e.g. salesforce credentials)."""
    data = _read_all()
    val = data.get(key)
    return val if isinstance(val, dict) else None


def set_value(key: str, value: Any) -> None:
    data = _read_all()
    data[key] = value
    _write_all(data)


def delete(key: str) -> bool:
    data = _read_all()
    if key not in data:
        return False
    del data[key]
    _write_all(data)
    return True
