from dataclasses import replace

from fastapi.testclient import TestClient

from main import create_app
from services.rate_limit import SlidingWindowRateLimiter

DEV_AUTH_HEADERS = {"Authorization": "Bearer dev-bypass:dGVzdEBleGFtcGxlLmNvbQ"}


class FakeLLMClient:
    def __init__(self, reply: str) -> None:
        self.reply = reply
        self.calls: list[list[dict[str, str]]] = []

    def generate_reply(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        return self.reply


def test_health() -> None:
    client = TestClient(create_app())
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_generate_reply_persists_user_and_app_messages() -> None:
    app = create_app()
    app.state.settings = replace(
        app.state.settings, openrouter_api_key="test-key", auth_dev_bypass=True
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    fake_llm = FakeLLMClient("Real model reply")
    app.state.llm_client = fake_llm
    client = TestClient(app)

    chat_resp = client.post(
        "/api/chats",
        json={"title": "Test chat", "position": {"x": 10, "y": 20}},
        headers=DEV_AUTH_HEADERS,
    )
    chat_id = chat_resp.json()["id"]

    resp = client.post(
        f"/api/chats/{chat_id}/generate",
        json={"text": "Hello there"},
        headers=DEV_AUTH_HEADERS,
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["userMessage"]["text"] == "Hello there"
    assert payload["userMessage"]["role"] == "user"
    assert payload["appMessage"]["text"] == "Real model reply"
    assert payload["appMessage"]["role"] == "app"
    assert fake_llm.calls[0][-1] == {"role": "user", "content": "Hello there"}


def test_generate_reply_rate_limits_requests() -> None:
    app = create_app()
    app.state.settings = replace(
        app.state.settings,
        openrouter_api_key="test-key",
        auth_dev_bypass=True,
        rate_limit_per_minute=10,
        rate_limit_burst=1,
        rate_limit_burst_window_seconds=60,
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    app.state.llm_client = FakeLLMClient("reply")
    client = TestClient(app)

    chat_resp = client.post(
        "/api/chats",
        json={"title": "Test chat", "position": {"x": 0, "y": 0}},
        headers=DEV_AUTH_HEADERS,
    )
    chat_id = chat_resp.json()["id"]

    first = client.post(
        f"/api/chats/{chat_id}/generate",
        json={"text": "First"},
        headers=DEV_AUTH_HEADERS,
    )
    second = client.post(
        f"/api/chats/{chat_id}/generate",
        json={"text": "Second"},
        headers=DEV_AUTH_HEADERS,
    )

    assert first.status_code == 200
    assert second.status_code == 429
    assert "Retry-After" in second.headers


def test_generate_reply_rejects_empty_or_oversized_input() -> None:
    app = create_app()
    app.state.settings = replace(
        app.state.settings,
        openrouter_api_key="test-key",
        auth_dev_bypass=True,
        max_prompt_chars=5,
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    app.state.llm_client = FakeLLMClient("reply")
    client = TestClient(app)

    chat_resp = client.post(
        "/api/chats",
        json={"title": "Test chat", "position": {"x": 0, "y": 0}},
        headers=DEV_AUTH_HEADERS,
    )
    chat_id = chat_resp.json()["id"]

    empty_resp = client.post(
        f"/api/chats/{chat_id}/generate",
        json={"text": "   "},
        headers=DEV_AUTH_HEADERS,
    )
    long_resp = client.post(
        f"/api/chats/{chat_id}/generate",
        json={"text": "123456"},
        headers=DEV_AUTH_HEADERS,
    )

    assert empty_resp.status_code == 400
    assert long_resp.status_code == 400


def test_generate_reply_surfaces_safe_provider_errors() -> None:
    class SafeFailLLMClient:
        def generate_reply(self, messages: list[dict[str, str]]) -> str:
            raise Exception("internal details should not leak")

    app = create_app()
    app.state.settings = replace(
        app.state.settings, openrouter_api_key="test-key", auth_dev_bypass=True
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    app.state.llm_client = SafeFailLLMClient()
    client = TestClient(app)

    chat_resp = client.post(
        "/api/chats",
        json={"title": "Test chat", "position": {"x": 0, "y": 0}},
        headers=DEV_AUTH_HEADERS,
    )
    chat_id = chat_resp.json()["id"]

    resp = client.post(
        f"/api/chats/{chat_id}/generate",
        json={"text": "Hello"},
        headers=DEV_AUTH_HEADERS,
    )

    assert resp.status_code == 502
    assert resp.json()["detail"] == "The language model is temporarily unavailable."
