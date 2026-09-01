"""SEC-API HTTP client."""

import time
from collections.abc import Callable
from typing import Any

import httpx


class SecApiError(RuntimeError):
    """Credential-safe SEC-API response failure."""

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        super().__init__(message)


class SecApiClient:
    """Small, credential-safe client for SEC-API Form ADV endpoints."""

    def __init__(
        self,
        api_key: str,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("api_key must not be empty")
        self._client = httpx.Client(
            base_url="https://api.sec-api.io/form-adv/",
            headers={"Authorization": api_key, "Content-Type": "application/json"},
            timeout=45.0,
            transport=transport,
        )
        self._sleep = sleep or time.sleep
        self._api_key = api_key

    def search_firms(self, query: str, *, size: int = 10) -> dict[str, Any]:
        """Search the current Form ADV firm index."""
        return self._search("firm", query, size=size, offset=0, sort_field="Filing.Dt")

    def search_individuals(self, query: str, *, size: int = 10, offset: int = 0) -> dict[str, Any]:
        """Search the current Form ADV individual index."""
        return self._search("individual", query, size=size, offset=offset, sort_field="Info.indvlPK")

    def _search(self, endpoint: str, query: str, *, size: int, offset: int, sort_field: str) -> dict[str, Any]:
        if not 1 <= size <= 50:
            raise ValueError("size must be between 1 and 50")
        if not 0 <= offset <= 10_000:
            raise ValueError("offset must be between 0 and 10000")
        payload = {
            "query": query,
            "from": offset,
            "size": size,
            "sort": [{sort_field: {"order": "desc"}}],
        }
        for attempt in range(3):
            response = self._client.post(endpoint, json=payload)
            if response.is_success:
                result = response.json()
                if not isinstance(result, dict):
                    raise TypeError("SEC-API returned a non-object response")
                return result
            if response.status_code != 429 and response.status_code < 500:
                raise SecApiError(response.status_code, f"SEC-API request failed with status {response.status_code}")
            if attempt == 2:
                raise SecApiError(response.status_code, f"SEC-API request failed with status {response.status_code}")
            retry_after = response.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else float(2**attempt)
            self._sleep(delay)
        raise AssertionError("retry loop exhausted unexpectedly")


__all__ = ["SecApiClient", "SecApiError"]
