from __future__ import annotations

from typing import Any

from schemas import GraphLayoutPutBody
from store.base import Store


def get_graph(*, user_id: str, store: Store) -> dict[str, Any]:
    chats = store.list_chats(user_id)
    messages = store.list_messages(user_id)
    edges = store.list_context_edges(user_id)

    return {
        "chats": [
            {
                "id": chat["id"],
                "title": chat["title"],
                "position": {"x": chat["position_x"], "y": chat["position_y"]},
            }
            for chat in chats
        ],
        "messages": [
            {
                "id": message["id"],
                "chatId": message["chat_id"],
                "ordinal": message["ordinal"],
                "role": message["role"],
                "text": message["text"],
            }
            for message in messages
        ],
        "contextEdges": [
            {
                "fromMessageId": edge["from_message_id"],
                "toChatId": edge["to_chat_id"],
                "rank": edge["rank"],
            }
            for edge in edges
        ],
    }


def put_graph_layout(*, user_id: str, body: GraphLayoutPutBody, store: Store) -> None:
    positions: dict[str, tuple[float, float]] = {
        chat_id: (pos.x, pos.y) for chat_id, pos in body.chatPositions.items()
    }
    store.update_chat_positions(user_id, positions)

    store.replace_context_edges(
        user_id,
        [
            {
                "from_message_id": edge.fromMessageId,
                "to_chat_id": edge.toChatId,
                "rank": edge.rank,
            }
            for edge in body.contextEdges
        ],
    )
