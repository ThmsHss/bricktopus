"""Salesforce wrapper.

Lives at the same DTO layer as Calendar / Gmail / Notion. Currently mock-
backed. Live mode reads credentials from the secrets store and would call
the REST API; the live branch is wired but stubbed (raises) until the
adapter for SOQL queries lands.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..services import secrets
from .base import SourceMode, SourceStatus


@dataclass(frozen=True)
class SalesforceCredentials:
    instance_url: str
    username: str
    has_password: bool
    has_token: bool


def _credentials() -> Optional[dict]:
    return secrets.get_dict("salesforce")


def has_credentials() -> bool:
    creds = _credentials()
    if not creds:
        return False
    return all(
        bool(creds.get(k))
        for k in ("instance_url", "username", "password", "security_token")
    )


class SalesforceClient:
    name = "salesforce"

    def status(self) -> SourceStatus:
        live = has_credentials()
        creds = _credentials() if live else None
        return SourceStatus(
            name=self.name,
            mode=SourceMode.LIVE if live else SourceMode.MOCK,
            authenticated=live,
            detail=(
                f"Connected to {creds['instance_url']} as {creds['username']}."
                if live and creds
                else (
                    "Salesforce not connected. Click Connect and provide "
                    "instance URL + username + password + security token."
                )
            ),
        )

    def credentials_summary(self) -> Optional[SalesforceCredentials]:
        creds = _credentials()
        if not creds:
            return None
        return SalesforceCredentials(
            instance_url=str(creds.get("instance_url", "")),
            username=str(creds.get("username", "")),
            has_password=bool(creds.get("password")),
            has_token=bool(creds.get("security_token")),
        )
