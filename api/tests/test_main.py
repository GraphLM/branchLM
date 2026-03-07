from dataclasses import replace

from fastapi.testclient import TestClient

from main import create_app
from services.llm_service import LLMServiceError
from services.rate_limit import SlidingWindowRateLimiter

DEV_AUTH_HEADERS = {"Authorization": "Bearer dev-bypass:dGVzdEBleGFtcGxlLmNvbQ"}


class FakeLLMClient:
    def __init__(self, reply: str) -> None:
        self.reply = reply
        self.calls: list[list[dict[str, str]]] = []

    def generate_reply(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        return self.reply


def _create_workspace(client: TestClient, title: str = "Untitled workspace") -> str:
    resp = client.post("/api/workspaces", json={"title": title}, headers=DEV_AUTH_HEADERS)
    assert resp.status_code == 200
    return resp.json()["id"]


def _create_chat(client: TestClient, workspace_id: str, title: str = "Test chat") -> str:
    resp = client.post(
        f"/api/workspaces/{workspace_id}/chats",
        json={"title": title, "position": {"x": 10, "y": 20}},
        headers=DEV_AUTH_HEADERS,
    )
    assert resp.status_code == 200
    return resp.json()["id"]


def test_health() -> None:
    client = TestClient(create_app())
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_workspaces_crud() -> None:
    client = TestClient(create_app())

    created = client.post(
        "/api/workspaces", json={"title": "Workspace A"}, headers=DEV_AUTH_HEADERS
    )
    assert created.status_code == 200
    workspace_id = created.json()["id"]

    listed = client.get("/api/workspaces", headers=DEV_AUTH_HEADERS)
    assert listed.status_code == 200
    assert any(workspace["id"] == workspace_id for workspace in listed.json())

    patched = client.patch(
        f"/api/workspaces/{workspace_id}",
        json={"title": "Workspace B"},
        headers=DEV_AUTH_HEADERS,
    )
    assert patched.status_code == 200

    relisted = client.get("/api/workspaces", headers=DEV_AUTH_HEADERS)
    assert any(
        workspace["id"] == workspace_id and workspace["title"] == "Workspace B"
        for workspace in relisted.json()
    )

    deleted = client.delete(f"/api/workspaces/{workspace_id}", headers=DEV_AUTH_HEADERS)
    assert deleted.status_code == 200


def test_generate_reply_persists_user_and_app_messages() -> None:
    app = create_app()
    app.state.settings = replace(
        app.state.settings, openrouter_api_key="test-key", auth_dev_bypass=True
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    fake_llm = FakeLLMClient("Real model reply")
    app.state.llm_client = fake_llm
    client = TestClient(app)

    workspace_id = _create_workspace(client)
    chat_id = _create_chat(client, workspace_id)

    resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/generate",
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

    workspace_id = _create_workspace(client)
    chat_id = _create_chat(client, workspace_id)

    first = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/generate",
        json={"text": "First"},
        headers=DEV_AUTH_HEADERS,
    )
    second = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/generate",
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

    workspace_id = _create_workspace(client)
    chat_id = _create_chat(client, workspace_id)

    empty_resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/generate",
        json={"text": "   "},
        headers=DEV_AUTH_HEADERS,
    )
    long_resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/generate",
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

    workspace_id = _create_workspace(client)
    chat_id = _create_chat(client, workspace_id)

    resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/generate",
        json={"text": "Hello"},
        headers=DEV_AUTH_HEADERS,
    )

    assert resp.status_code == 502
    assert resp.json()["detail"] == "The language model is temporarily unavailable."


def test_workspace_isolation_and_mismatch_rejected() -> None:
    client = TestClient(create_app())

    workspace_a = _create_workspace(client, "A")
    workspace_b = _create_workspace(client, "B")
    chat_id = _create_chat(client, workspace_a, "Chat in A")

    mismatch_resp = client.post(
        f"/api/workspaces/{workspace_b}/chats/{chat_id}/messages",
        json={"role": "user", "text": "Should fail"},
        headers=DEV_AUTH_HEADERS,
    )
    assert mismatch_resp.status_code == 404


def test_context_splicing_from_user_message_excludes_the_target_user_message() -> None:
    app = create_app()
    app.state.settings = replace(
        app.state.settings, openrouter_api_key="test-key", auth_dev_bypass=True
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    fake_llm = FakeLLMClient("reply")
    app.state.llm_client = fake_llm
    client = TestClient(app)

    workspace_id = _create_workspace(client)
    source_chat_id = _create_chat(client, workspace_id, "Source")
    target_chat_id = _create_chat(client, workspace_id, "Target")

    m0 = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "user", "text": "u0"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    m1 = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "app", "text": "a0"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    m2 = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "user", "text": "u1"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    assert m0 and m1 and m2

    graph_put = client.put(
        f"/api/workspaces/{workspace_id}/graph/layout",
        json={
            "chatPositions": {},
            "contextEdges": [
                {
                    "fromMessageId": m2,
                    "toChatId": target_chat_id,
                    "rank": 0,
                }
            ],
        },
        headers=DEV_AUTH_HEADERS,
    )
    assert graph_put.status_code == 200

    generate_resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{target_chat_id}/generate",
        json={"text": "new question"},
        headers=DEV_AUTH_HEADERS,
    )
    assert generate_resp.status_code == 200

    assert fake_llm.calls
    assert fake_llm.calls[-1] == [
        {"role": "user", "content": "u0"},
        {"role": "assistant", "content": "a0"},
        {"role": "user", "content": "new question"},
    ]


def test_context_splicing_from_app_message_includes_the_target_app_message() -> None:
    app = create_app()
    app.state.settings = replace(
        app.state.settings, openrouter_api_key="test-key", auth_dev_bypass=True
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    fake_llm = FakeLLMClient("reply")
    app.state.llm_client = fake_llm
    client = TestClient(app)

    workspace_id = _create_workspace(client)
    source_chat_id = _create_chat(client, workspace_id, "Source")
    target_chat_id = _create_chat(client, workspace_id, "Target")

    m0 = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "user", "text": "u0"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    m1 = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "app", "text": "a0"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    m2 = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "user", "text": "u1"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    m3 = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "app", "text": "a1"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    assert m0 and m1 and m2 and m3

    graph_put = client.put(
        f"/api/workspaces/{workspace_id}/graph/layout",
        json={
            "chatPositions": {},
            "contextEdges": [
                {
                    "fromMessageId": m3,
                    "toChatId": target_chat_id,
                    "rank": 0,
                }
            ],
        },
        headers=DEV_AUTH_HEADERS,
    )
    assert graph_put.status_code == 200

    generate_resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{target_chat_id}/generate",
        json={"text": "new question"},
        headers=DEV_AUTH_HEADERS,
    )
    assert generate_resp.status_code == 200

    assert fake_llm.calls
    assert fake_llm.calls[-1] == [
        {"role": "user", "content": "u0"},
        {"role": "assistant", "content": "a0"},
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "new question"},
    ]


def test_generate_reply_token_budget_prioritizes_target_chat_history() -> None:
    app = create_app()
    app.state.settings = replace(
        app.state.settings,
        openrouter_api_key="test-key",
        auth_dev_bypass=True,
        max_history_messages=20,
        model_context_window_tokens=80,
        max_completion_tokens=10,
        input_token_safety_margin=10,
        estimated_chars_per_token=1,
        context_summary_max_chars=0,
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    fake_llm = FakeLLMClient("reply")
    app.state.llm_client = fake_llm
    client = TestClient(app)

    workspace_id = _create_workspace(client)
    source_chat_id = _create_chat(client, workspace_id, "Source")
    target_chat_id = _create_chat(client, workspace_id, "Target")

    source_app = client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "app", "text": "source app message that should be dropped first"},
        headers=DEV_AUTH_HEADERS,
    ).json()["id"]
    client.post(
        f"/api/workspaces/{workspace_id}/chats/{source_chat_id}/messages",
        json={"role": "user", "text": "source user message"},
        headers=DEV_AUTH_HEADERS,
    )
    client.post(
        f"/api/workspaces/{workspace_id}/chats/{target_chat_id}/messages",
        json={"role": "user", "text": "target user message kept"},
        headers=DEV_AUTH_HEADERS,
    )
    client.post(
        f"/api/workspaces/{workspace_id}/chats/{target_chat_id}/messages",
        json={"role": "app", "text": "target app message kept"},
        headers=DEV_AUTH_HEADERS,
    )

    graph_put = client.put(
        f"/api/workspaces/{workspace_id}/graph/layout",
        json={
            "chatPositions": {},
            "contextEdges": [
                {
                    "fromMessageId": source_app,
                    "toChatId": target_chat_id,
                    "rank": 0,
                }
            ],
        },
        headers=DEV_AUTH_HEADERS,
    )
    assert graph_put.status_code == 200

    generate_resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{target_chat_id}/generate",
        json={"text": "new question"},
        headers=DEV_AUTH_HEADERS,
    )
    assert generate_resp.status_code == 200
    sent = fake_llm.calls[-1]

    assert {"role": "assistant", "content": "target app message kept"} in sent
    assert not any("source app message that should be dropped first" == m["content"] for m in sent)


def test_generate_reply_retries_once_when_context_overflowed() -> None:
    class ContextOverflowThenSuccess:
        def __init__(self) -> None:
            self.calls: list[list[dict[str, str]]] = []

        def generate_reply(self, messages: list[dict[str, str]]) -> str:
            self.calls.append(messages)
            if len(self.calls) == 1:
                raise LLMServiceError(
                    "The prompt exceeded the model context window.",
                    code="context_length_exceeded",
                )
            return "Recovered response"

    app = create_app()
    app.state.settings = replace(
        app.state.settings, openrouter_api_key="test-key", auth_dev_bypass=True
    )
    app.state.rate_limiter = SlidingWindowRateLimiter(app.state.settings)
    flaky_llm = ContextOverflowThenSuccess()
    app.state.llm_client = flaky_llm
    client = TestClient(app)

    workspace_id = _create_workspace(client)
    chat_id = _create_chat(client, workspace_id)

    for idx in range(6):
        client.post(
            f"/api/workspaces/{workspace_id}/chats/{chat_id}/messages",
            json={"role": "user" if idx % 2 == 0 else "app", "text": f"m{idx}"},
            headers=DEV_AUTH_HEADERS,
        )

    resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/generate",
        json={"text": "new prompt"},
        headers=DEV_AUTH_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["appMessage"]["text"] == "Recovered response"
    assert len(flaky_llm.calls) == 2
    assert len(flaky_llm.calls[1]) < len(flaky_llm.calls[0])


def test_delete_workspace_cascades_graph_data() -> None:
    client = TestClient(create_app())

    workspace_id = _create_workspace(client, "Cascade")
    chat_id = _create_chat(client, workspace_id)

    message_resp = client.post(
        f"/api/workspaces/{workspace_id}/chats/{chat_id}/messages",
        json={"role": "user", "text": "msg"},
        headers=DEV_AUTH_HEADERS,
    )
    assert message_resp.status_code == 200

    delete_resp = client.delete(f"/api/workspaces/{workspace_id}", headers=DEV_AUTH_HEADERS)
    assert delete_resp.status_code == 200

    graph_resp = client.get(f"/api/workspaces/{workspace_id}/graph", headers=DEV_AUTH_HEADERS)
    assert graph_resp.status_code == 404
