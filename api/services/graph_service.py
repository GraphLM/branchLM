from __future__ import annotations

from typing import Any

from schemas import GraphLayoutPutBody
from store.base import Store

CHAT_DEFAULT_WIDTH = 440.0
CHAT_DEFAULT_HEIGHT = 360.0


def get_graph(*, user_id: str, workspace_id: str, store: Store) -> dict[str, Any]:
    chats = store.list_chats(user_id, workspace_id)
    messages = store.list_messages(user_id, workspace_id)
    edges = store.list_context_edges(user_id, workspace_id)

    return {
        "chats": [
            {
                "id": c["id"],
                "workspaceId": c["workspace_id"],
                "title": c["title"],
                "model": c.get("model"),
                "position": {"x": c["position_x"], "y": c["position_y"]},
                "size": (
                    {"width": c.get("width"), "height": c.get("height")}
                    if (
                        c.get("width") is not None
                        and c.get("height") is not None
                        and (
                            c.get("width") != CHAT_DEFAULT_WIDTH
                            or c.get("height") != CHAT_DEFAULT_HEIGHT
                        )
                    )
                    else None
                ),
            }
            for c in chats
        ],
        "messages": [
            {
                "id": m["id"],
                "chatId": m["chat_id"],
                "ordinal": m["ordinal"],
                "role": m["role"],
                "text": m["text"],
            }
            for m in messages
        ],
        "contextEdges": [
            {
                "fromMessageId": e["from_message_id"],
                "toChatId": e["to_chat_id"],
                "rank": e["rank"],
            }
            for e in edges
        ],
    }


def put_graph_layout(
    *, user_id: str, workspace_id: str, body: GraphLayoutPutBody, store: Store
) -> None:
    positions: dict[str, tuple[float, float]] = {
        chat_id: (pos.x, pos.y) for chat_id, pos in body.chatPositions.items()
    }
    sizes: dict[str, tuple[float, float]] = {
        chat_id: (size.width, size.height) for chat_id, size in body.chatSizes.items()
    }
    store.update_chat_layout(user_id, workspace_id, positions, sizes)

    store.replace_context_edges(
        user_id,
        workspace_id,
        [
            {
                "from_message_id": e.fromMessageId,
                "to_chat_id": e.toChatId,
                "rank": e.rank,
            }
            for e in body.contextEdges
        ],
    )
