import json

import httpx
import pytest

from riascout_adv_data.api import SecApiClient, SecApiError


def test_client_authenticates_with_header_and_keeps_key_out_of_url() -> None:
    observed: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["authorization"] = request.headers["Authorization"]
        observed["url"] = str(request.url)
        observed["body"] = request.content.decode("utf-8")
        return httpx.Response(200, json={"total": {"value": 0, "relation": "eq"}, "filings": []})

    client = SecApiClient("super-secret", transport=httpx.MockTransport(handler))
    response = client.search_firms("Info.FirmCrdNb:361", size=2)

    assert response["total"] == {"value": 0, "relation": "eq"}
    assert observed["authorization"] == "super-secret"
    assert observed["url"] == "https://api.sec-api.io/form-adv/firm"
    assert json.loads(observed["body"]) == {
        "query": "Info.FirmCrdNb:361",
        "from": 0,
        "size": 2,
        "sort": [{"Filing.Dt": {"order": "desc"}}],
    }


def test_client_rejects_page_sizes_above_documented_limit() -> None:
    client = SecApiClient("super-secret", transport=httpx.MockTransport(lambda _: httpx.Response(200)))

    try:
        client.search_firms("*", size=51)
    except ValueError as error:
        assert str(error) == "size must be between 1 and 50"
    else:
        raise AssertionError("size=51 must not be accepted")


def test_client_searches_individuals_with_individual_sort_field() -> None:
    observed_body: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed_body.update(json.loads(request.content))
        return httpx.Response(200, json={"total": {"value": 1, "relation": "eq"}, "filings": [{"id": 5296640}]})

    client = SecApiClient("super-secret", transport=httpx.MockTransport(handler))

    result = client.search_individuals("CrntEmps.CrntEmp.orgPK:361", size=1)

    assert result["filings"] == [{"id": 5296640}]
    assert observed_body["sort"] == [{"Info.indvlPK": {"order": "desc"}}]


def test_individual_search_sends_requested_offset() -> None:
    observed_body: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed_body.update(json.loads(request.content))
        return httpx.Response(200, json={"total": {"value": 1, "relation": "eq"}, "filings": []})

    client = SecApiClient("super-secret", transport=httpx.MockTransport(handler))
    client.search_individuals("Info.indvlPK:[1 TO 100]", size=50, offset=100)

    assert observed_body["from"] == 100
    assert observed_body["size"] == 50


@pytest.mark.parametrize("offset", [-1, 10_001])
def test_individual_search_rejects_invalid_offset(offset: int) -> None:
    client = SecApiClient("super-secret", transport=httpx.MockTransport(lambda _: httpx.Response(200)))

    with pytest.raises(ValueError, match="offset"):
        client.search_individuals("*", offset=offset)


def test_client_retries_rate_limit_response_and_honors_retry_after() -> None:
    attempts = 0
    observed_delays: list[float] = []

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "2"}, json={"message": "rate limited"})
        return httpx.Response(200, json={"total": {"value": 0, "relation": "eq"}, "filings": []})

    client = SecApiClient(
        "super-secret",
        transport=httpx.MockTransport(handler),
        sleep=observed_delays.append,
    )

    result = client.search_firms("Info.FirmCrdNb:361")

    assert result["filings"] == []
    assert attempts == 2
    assert observed_delays == [2.0]


def test_client_does_not_retry_authentication_failure_or_expose_key() -> None:
    attempts = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(401, json={"message": "invalid key super-secret"})

    client = SecApiClient("super-secret", transport=httpx.MockTransport(handler), sleep=lambda _: None)

    with pytest.raises(SecApiError) as error:
        client.search_firms("Info.FirmCrdNb:361")

    assert error.value.status_code == 401
    assert "super-secret" not in str(error.value)
    assert attempts == 1
