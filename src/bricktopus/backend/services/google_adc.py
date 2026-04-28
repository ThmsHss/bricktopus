"""Google Application-Default-Credentials helper.

Reads the credentials gcloud writes via `gcloud auth application-default
login`. Lets the calendar / gmail wrappers run live without each one
re-implementing OAuth. Quota project header is required because we run
under the field-engineering shared GCP project.
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

QUOTA_PROJECT_HEADER = "x-goog-user-project"
QUOTA_PROJECT = os.environ.get(
    "BRICKTOPUS_GCP_QUOTA_PROJECT", "gcp-dev-field-eng-aiapiquota"
)


def _adc_path() -> Path:
    override = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if override:
        return Path(override)
    return Path.home() / ".config" / "gcloud" / "application_default_credentials.json"


def adc_present() -> bool:
    return _adc_path().exists()


def adc_email() -> Optional[str]:
    """Best-effort: pull the email from the gcloud config (separate file)."""
    try:
        # gcloud's active account email lives here
        active = (
            Path.home() / ".config" / "gcloud" / "active_config"
        ).read_text().strip()
        config = (
            Path.home() / ".config" / "gcloud" / "configurations" / f"config_{active}"
        )
        for line in config.read_text().splitlines():
            if line.startswith("account"):
                return line.split("=", 1)[1].strip()
    except (OSError, IndexError):
        pass
    return None


@lru_cache(maxsize=1)
def _credentials():
    """Build google.auth credentials from ADC, with quota project set."""
    from google.auth import default
    from google.auth.transport.requests import Request

    if not adc_present():
        raise RuntimeError(
            "Google Application Default Credentials not found. "
            "Run `gcloud auth application-default login` first."
        )

    scopes = [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/gmail.readonly",
    ]
    creds, _project = default(scopes=scopes, quota_project_id=QUOTA_PROJECT)

    # Some token states need an explicit refresh before first call.
    if not creds.valid:
        try:
            creds.refresh(Request())
        except Exception as exc:  # pragma: no cover - surfaced by the caller
            logger.warning("Could not refresh ADC token: %s", exc)
    return creds


def build_service(api_name: str, version: str):
    """Build a Google API client.

    `googleapiclient` discovery loads the API surface; the returned object
    is the standard service handle (`service.events().list(...)` etc.).
    """
    from googleapiclient.discovery import build

    creds = _credentials()
    return build(
        api_name,
        version,
        credentials=creds,
        cache_discovery=False,
    )
