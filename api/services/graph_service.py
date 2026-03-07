from __future__ import annotations

from typing import Any

from schemas import GraphLayoutPutBody
from store.base import Store


def get_graph(*, user_id: str, workspace_id: str, store: Store) -> dict[str, Any]:
    chats = store.list_chats(user_id, workspace_id)
    messages = store.list_messages(user_id, workspace_id)
    edges = store.list_context_edges(user_id, workspace_id)
    context_nodes = store.list_context_nodes(user_id, workspace_id)
    context_node_edges = store.list_context_node_edges(user_id, workspace_id)

    return {
        "chats": [
            {
                "id": c["id"],
                "workspaceId": c["workspace_id"],
                "title": c["title"],
                "model": c.get("model"),
                "position": {"x": c["position_x"], "y": c["position_y"]},
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
        "contextNodes": [
            {
                "id": n["id"],
                "workspaceId": n["workspace_id"],
                "title": n["title"],
                "position": {"x": n["position_x"], "y": n["position_y"]},
                "assetCount": len(store.list_context_node_assets(user_id, workspace_id, n["id"])),
            }
            for n in context_nodes
        ],
        "contextNodeEdges": [
            {
                "fromContextNodeId": e["from_context_node_id"],
                "toChatId": e["to_chat_id"],
                "rank": e["rank"],
            }
            for e in context_node_edges
        ],
    }


def put_graph_layout(
    *, user_id: str, workspace_id: str, body: GraphLayoutPutBody, store: Store
) -> None:
    positions: dict[str, tuple[float, float]] = {
        chat_id: (pos.x, pos.y) for chat_id, pos in body.chatPositions.items()
    }
    store.update_chat_positions(user_id, workspace_id, positions)
    context_node_positions: dict[str, tuple[float, float]] = {
        context_node_id: (pos.x, pos.y)
        for context_node_id, pos in body.contextNodePositions.items()
    }
    store.update_context_node_positions(user_id, workspace_id, context_node_positions)

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
    store.replace_context_node_edges(
        user_id,
        workspace_id,
        [
            {
                "from_context_node_id": e.fromContextNodeId,
                "to_chat_id": e.toChatId,
                "rank": e.rank,
            }
            for e in body.contextNodeEdges
        ],
    )
