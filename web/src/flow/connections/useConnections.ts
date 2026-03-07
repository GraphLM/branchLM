import { useCallback, useEffect, useRef, useState } from "react";
import { addEdge, type OnConnect, type OnConnectEnd, type OnConnectStart } from "@xyflow/react";
import { createChatNode } from "../layout";
import { applyAutoLayout } from "../graph/graphModel";
import { createChat } from "./connectionsApi";
import {
  buildContextEdgeId,
  createContextEdge,
  createContextEdgeFromConnection,
  isMessageToChatConnection,
  type UseConnectionsParams,
} from "./connectionsModel";

export function useConnections(params: UseConnectionsParams) {
  const { nodes, setNodes, setEdges, screenToFlowPosition } = params;
  const connectStartNodeIdRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  const [pendingSourceMessageId, setPendingSourceMessageId] = useState<string | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    if (!pendingSourceMessageId) return;
    if (nodes.some((n) => n.id === pendingSourceMessageId)) return;
    setPendingSourceMessageId(null);
  }, [nodes, pendingSourceMessageId]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      if (
        !isMessageToChatConnection({
          sourceId: connection.source,
          targetId: connection.target,
          nodes: nodesRef.current,
        })
      ) {
        return;
      }

      setPendingSourceMessageId(null);
      const edgeId = buildContextEdgeId(connection.source, connection.target);
      setEdges((edgesSnapshot) => {
        if (edgesSnapshot.some((e) => e.id === edgeId)) return edgesSnapshot;
        return addEdge(createContextEdgeFromConnection(connection), edgesSnapshot);
      });
    },
    [setEdges],
  );

  const onConnectStart: OnConnectStart = useCallback((_event, nodeHandle) => {
    setPendingSourceMessageId(null);
    connectStartNodeIdRef.current = nodeHandle.nodeId;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    async (event, connectionState) => {
      const fromNodeId = connectStartNodeIdRef.current;
      connectStartNodeIdRef.current = null;

      if (!fromNodeId) return;
      if (connectionState.isValid === true) return;

      const fromNode = nodesRef.current.find((n) => n.id === fromNodeId);
      if (!fromNode || fromNode.type !== "message") return;

      const clientPoint =
        "touches" in event && event.touches.length > 0
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : "changedTouches" in event && event.changedTouches.length > 0
            ? {
                x: event.changedTouches[0].clientX,
                y: event.changedTouches[0].clientY,
              }
            : {
                x: (event as MouseEvent).clientX,
                y: (event as MouseEvent).clientY,
              };

      const position = screenToFlowPosition({
        x: clientPoint.x,
        y: clientPoint.y,
      });

      const createdChat = await createChat({
        title: "New chat",
        position,
      });
      if (!createdChat) return;

      setNodes((ns) =>
        applyAutoLayout(
          ns.concat(
            createChatNode({
              id: createdChat.id,
              position,
              title: createdChat.title,
            }),
          ),
        ),
      );

      setEdges((es) =>
        addEdge(createContextEdge({ sourceId: fromNodeId, targetId: createdChat.id }), es),
      );
    },
    [screenToFlowPosition, setEdges, setNodes],
  );

  const onMessageSourceHandleActivate = useCallback(
    (messageId: string) => {
      const node = nodesRef.current.find((n) => n.id === messageId);
      if (!node || node.type !== "message") return;
      setPendingSourceMessageId((current) => (current === messageId ? null : messageId));
    },
    [],
  );

  const onChatTargetHandleActivate = useCallback(
    (chatId: string) => {
      if (!pendingSourceMessageId) return;

      if (
        !isMessageToChatConnection({
          sourceId: pendingSourceMessageId,
          targetId: chatId,
          nodes: nodesRef.current,
        })
      ) {
        return;
      }

      const edgeId = buildContextEdgeId(pendingSourceMessageId, chatId);
      setEdges((edgesSnapshot) => {
        if (edgesSnapshot.some((e) => e.id === edgeId)) return edgesSnapshot;
        return addEdge(
          createContextEdge({ sourceId: pendingSourceMessageId, targetId: chatId }),
          edgesSnapshot,
        );
      });
      setPendingSourceMessageId(null);
    },
    [pendingSourceMessageId, setEdges],
  );

  return {
    pendingSourceMessageId,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onPaneClick: () => setPendingSourceMessageId(null),
    onMessageSourceHandleActivate,
    onChatTargetHandleActivate,
  };
}
