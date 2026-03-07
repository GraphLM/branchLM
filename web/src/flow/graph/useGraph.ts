import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarkerType,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import { createChatNode, createMessageNode, layoutChatNodesInGrid } from "../layout";
import type { AppNode } from "../types";
import { deleteChat, deleteMessage, fetchGraph, saveGraphLayout } from "./graphApi";
import { applyAutoLayout, collectCascadeRemoval, styleRenderedEdges } from "./graphModel";

function persistCascadeDeletes(params: {
  chatIds: Set<string>;
  messageIds: Set<string>;
}) {
  for (const chatId of params.chatIds) {
    deleteChat({ chatId }).catch(() => {});
  }
  for (const messageId of params.messageIds) {
    deleteMessage({ messageId }).catch(() => {});
  }
}

export function useGraph(params: {
  fitView: (options?: { duration?: number; padding?: number }) => void;
}) {
  const hasLoadedPersistedStateRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const loadedGraphSuccessfullyRef = useRef(false);

  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const data = await fetchGraph({ signal: controller.signal });
        if (!data || cancelled) return;

        const serverHasData = (data.chats?.length ?? 0) > 0 || (data.messages?.length ?? 0) > 0;

        if (!serverHasData) {
          setNodes([]);
          setEdges([]);
          loadedGraphSuccessfullyRef.current = true;
          return;
        }

        const nextNodes: AppNode[] = [];
        for (const c of data.chats ?? []) {
          nextNodes.push(createChatNode({ id: c.id, position: c.position, title: c.title }));
        }
        for (const m of data.messages ?? []) {
          nextNodes.push(
            createMessageNode({
              id: m.id,
              chatId: m.chatId,
              indexInChat: m.ordinal,
              role: m.role,
              text: m.text,
            }),
          );
        }

        const nextEdges: Edge[] = (data.contextEdges ?? []).map((e) => ({
          id: `ctx:${e.fromMessageId}->${e.toChatId}`,
          source: e.fromMessageId,
          target: e.toChatId,
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: false,
        }));

        setNodes(applyAutoLayout(nextNodes));
        setEdges(nextEdges);
        loadedGraphSuccessfullyRef.current = true;
      } catch {
        // ignore (offline / backend not running)
      } finally {
        if (!cancelled) {
          hasLoadedPersistedStateRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedStateRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      if (!loadedGraphSuccessfullyRef.current) return;

      saveGraphLayout({ nodes, edges }).catch(() => {
        // ignore
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [edges, nodes]);

  useEffect(() => {
    setNodes((ns) => applyAutoLayout(ns));
  }, []);

  const deleteNodesCascade = useCallback(
    (nodeIds: Set<string>) => {
      const snapshotRemoval = collectCascadeRemoval(nodes, nodeIds);
      persistCascadeDeletes({
        chatIds: snapshotRemoval.removedChatIds,
        messageIds: snapshotRemoval.removedMessageIds,
      });

      setNodes((nodesSnapshot) => {
        const runtimeRemoval = collectCascadeRemoval(nodesSnapshot, nodeIds);
        setEdges((edgesSnapshot) =>
          edgesSnapshot.filter(
            (e) =>
              !runtimeRemoval.removedAllIds.has(e.source) &&
              !runtimeRemoval.removedAllIds.has(e.target),
          ),
        );

        return applyAutoLayout(
          nodesSnapshot.filter((n) => !runtimeRemoval.removedAllIds.has(n.id)),
        );
      });
    },
    [nodes],
  );

  const deleteChatById = useCallback(
    (chatId: string) => {
      deleteNodesCascade(new Set([chatId]));
    },
    [deleteNodesCascade],
  );

  const deleteMessageById = useCallback(
    (messageId: string) => {
      deleteNodesCascade(new Set([messageId]));
    },
    [deleteNodesCascade],
  );

  const onNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes) => {
      const removedIds = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));

      if (removedIds.size > 0) {
        const removal = collectCascadeRemoval(nodes, removedIds);
        persistCascadeDeletes({
          chatIds: removal.removedChatIds,
          messageIds: removal.removedMessageIds,
        });
      }

      setNodes((nodesSnapshot) => {
        const removal = collectCascadeRemoval(nodesSnapshot, removedIds);

        if (removal.removedAllIds.size > 0) {
          setEdges((edgesSnapshot) =>
            edgesSnapshot.filter(
              (e) =>
                !removal.removedAllIds.has(e.source) &&
                !removal.removedAllIds.has(e.target),
            ),
          );
        }

        const next = applyNodeChanges(changes, nodesSnapshot).filter(
          (n) => !(n.type === "message" && n.parentId && removal.removedChatIds.has(n.parentId)),
        );

        return applyAutoLayout(next);
      });
    },
    [nodes],
  );

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot));
  }, []);

  const onAutoLayout = useCallback(() => {
    setNodes((ns) => applyAutoLayout(layoutChatNodesInGrid(ns)));
    setTimeout(() => params.fitView({ duration: 300, padding: 0.2 }), 50);
  }, [params]);

  const renderedEdges = useMemo(
    () => styleRenderedEdges({ edges, hoveredEdgeId }),
    [edges, hoveredEdgeId],
  );

  return {
    nodes,
    edges,
    renderedEdges,
    isLocked,
    setNodes,
    setEdges,
    setIsLocked,
    deleteChatById,
    deleteMessageById,
    onNodesChange,
    onEdgesChange,
    onAutoLayout,
    onEdgeMouseEnter: (_event: React.MouseEvent, edge: Edge) => setHoveredEdgeId(edge.id),
    onEdgeMouseLeave: () => setHoveredEdgeId(null),
  };
}
