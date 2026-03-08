import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  MarkerType,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import {
  createChatNode,
  createContextNode,
  createMessageNode,
  layoutChatNodesInGrid,
} from "../layout";
import type { AppNode } from "../types";
import {
  createContextNode as createContextNodeApi,
  deleteChat,
  deleteContextNode,
  deleteMessage,
  fetchGraph,
  saveGraphLayout,
  updateContextNodeTitle as updateContextNodeTitleApi,
  uploadContextNodeAsset,
  uploadContextNodeTextAsset,
} from "./graphApi";
import {
  applyAutoLayout,
  buildChatPositions,
  buildContextEdgesForSave,
  buildContextNodeEdgesForSave,
  buildContextNodePositions,
  collectCascadeRemoval,
  styleRenderedEdges,
} from "./graphModel";

function persistCascadeDeletes(params: {
  workspaceId: string;
  chatIds: Set<string>;
  messageIds: Set<string>;
}) {
  void (async () => {
    // Delete leaf messages first so we do not hit 404s after chat-level cascades.
    for (const messageId of params.messageIds) {
      await deleteMessage({ workspaceId: params.workspaceId, messageId }).catch(() => {});
    }
    for (const chatId of params.chatIds) {
      await deleteChat({ workspaceId: params.workspaceId, chatId }).catch(() => {});
    }
  })();
}

function suggestTitleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[a-z0-9]+$/i, "");
  const cleaned = withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Context node";
  return cleaned.length > 36 ? `${cleaned.slice(0, 36).trim()}...` : cleaned;
}

function suggestTitleFromText(text: string): string {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  const cleaned = firstLine.replace(/\s+/g, " ");
  if (!cleaned) return "Context note";
  const words = cleaned.split(" ").slice(0, 6).join(" ");
  return words.length > 36 ? `${words.slice(0, 36).trim()}...` : words;
}

export function useGraph(params: {
  workspaceId: string | null;
  fitView: (options?: { duration?: number; padding?: number }) => void;
}) {
  const hasLoadedPersistedStateRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const loadedGraphSuccessfullyRef = useRef(false);
  const lastSavedLayoutFingerprintRef = useRef<string>("");

  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const persistLayoutNow = useCallback(
    async (snapshot?: { nodes: AppNode[]; edges: Edge[] }) => {
      const workspaceId = params.workspaceId;
      if (!workspaceId) return;
      const nextNodes = snapshot?.nodes ?? nodes;
      const nextEdges = snapshot?.edges ?? edges;
      const fingerprint = JSON.stringify({
        chatPositions: buildChatPositions(nextNodes),
        contextNodePositions: buildContextNodePositions(nextNodes),
        contextEdges: buildContextEdgesForSave({ nodes: nextNodes, edges: nextEdges }),
        contextNodeEdges: buildContextNodeEdgesForSave({ nodes: nextNodes, edges: nextEdges }),
      });
      if (fingerprint === lastSavedLayoutFingerprintRef.current) return;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await saveGraphLayout({ workspaceId, nodes: nextNodes, edges: nextEdges });
          lastSavedLayoutFingerprintRef.current = fingerprint;
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      throw lastError ?? new Error("Failed to save graph layout");
    },
    [edges, nodes, params.workspaceId],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setNodes([]);
    setEdges([]);
    loadedGraphSuccessfullyRef.current = false;
    hasLoadedPersistedStateRef.current = false;

    const workspaceId = params.workspaceId;
    if (!workspaceId) {
      hasLoadedPersistedStateRef.current = true;
      loadedGraphSuccessfullyRef.current = true;
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    (async () => {
      try {
        const data = await fetchGraph({ workspaceId, signal: controller.signal });
        if (!data || cancelled) return;

        const serverHasData =
          (data.chats?.length ?? 0) > 0 ||
          (data.messages?.length ?? 0) > 0 ||
          (data.contextNodes?.length ?? 0) > 0;

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
        for (const n of data.contextNodes ?? []) {
          const status = (n.status ?? "").toLowerCase();
          const statusText =
            status === "indexed" || status === "ready" || status === "processed"
              ? "Ready"
              : status === "processing" || status === "pending"
                ? "Preparing document..."
                : status === "failed"
                  ? n.statusMessage ?? "Could not prepare document"
                  : n.statusMessage ?? undefined;
          nextNodes.push(
            createContextNode({
              id: n.id,
              workspaceId: n.workspaceId,
              position: n.position,
              title: n.title,
              assetCount: n.assetCount ?? 0,
              statusText,
            }),
          );
        }

        const nextEdges: Edge[] = (data.contextEdges ?? [])
          .map((e) => ({
            id: `ctx:${e.fromMessageId}->${e.toChatId}:${e.rank}`,
            source: e.fromMessageId,
            target: e.toChatId,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: false,
          }))
          .concat(
            (data.contextNodeEdges ?? []).map((e) => ({
              id: `ctxn:${e.fromContextNodeId}->${e.toChatId}:${e.rank}`,
              source: e.fromContextNodeId,
              target: e.toChatId,
              markerEnd: { type: MarkerType.ArrowClosed },
              animated: false,
            })),
          );

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
  }, [params.workspaceId]);

  useEffect(() => {
    const workspaceId = params.workspaceId;
    if (!workspaceId) return;
    if (!hasLoadedPersistedStateRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      if (!loadedGraphSuccessfullyRef.current) return;

      persistLayoutNow({ nodes, edges }).catch(() => {
        // ignore
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [edges, nodes, params.workspaceId, persistLayoutNow]);

  useEffect(() => {
    setNodes((ns) => applyAutoLayout(ns));
  }, []);

  const deleteNodesCascade = useCallback(
    (nodeIds: Set<string>) => {
      const workspaceId = params.workspaceId;
      if (!workspaceId) return;

      const snapshotRemoval = collectCascadeRemoval(nodes, nodeIds);
      persistCascadeDeletes({
        workspaceId,
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

        return applyAutoLayout(nodesSnapshot.filter((n) => !runtimeRemoval.removedAllIds.has(n.id)));
      });
    },
    [nodes, params.workspaceId],
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

  const deleteContextNodeById = useCallback(
    (contextNodeId: string) => {
      const workspaceId = params.workspaceId;
      if (!workspaceId) return;
      setNodes((nodesSnapshot) =>
        nodesSnapshot.filter((n) => n.id !== contextNodeId),
      );
      setEdges((edgesSnapshot) =>
        edgesSnapshot.filter((e) => e.source !== contextNodeId && e.target !== contextNodeId),
      );
      void deleteContextNode({ workspaceId, contextNodeId }).catch(() => {});
    },
    [params.workspaceId],
  );

  const updateContextNodeTitle = useCallback(
    (contextNodeId: string, title: string) => {
      const workspaceId = params.workspaceId;
      if (!workspaceId) return;
      const normalized = title.trim();
      if (!normalized) return;
      setNodes((nodesSnapshot) =>
        nodesSnapshot.map((n) =>
          n.id === contextNodeId && n.type === "context"
            ? { ...n, data: { ...n.data, title: normalized } }
            : n,
        ),
      );
      void updateContextNodeTitleApi({ workspaceId, contextNodeId, title: normalized }).catch(() => {});
    },
    [params.workspaceId],
  );

  const createContextNodeAt = useCallback(
    async (position: { x: number; y: number }) => {
      const workspaceId = params.workspaceId;
      if (!workspaceId) return;
      const created = await createContextNodeApi({
        workspaceId,
        title: "New context node",
        position,
      });
      if (!created) return;
      setNodes((ns) =>
        applyAutoLayout(
          ns.concat(
            createContextNode({
              id: created.id,
              workspaceId: created.workspaceId,
              position: created.position,
              title: created.title,
              assetCount: 0,
            }),
          ),
        ),
      );
    },
    [params.workspaceId],
  );

  const uploadAssetToContextNode = useCallback(
    async (contextNodeId: string, file: File) => {
      const workspaceId = params.workspaceId;
      if (!workspaceId) return;
      try {
        const contextNode = nodes.find(
          (n) => n.id === contextNodeId && n.type === "context",
        );
        const existing = contextNode?.type === "context" && (contextNode.data.assetCount ?? 0) > 0;
        const created = await uploadContextNodeAsset({
          workspaceId,
          contextNodeId,
          file,
          replace: existing,
        });
        setNodes((nodesSnapshot) =>
          nodesSnapshot.map((n) => {
            if (n.id !== contextNodeId || n.type !== "context") return n;
            return {
              ...n,
              data: {
                ...n.data,
                title: suggestTitleFromFileName(file.name),
                assetCount: 1,
                statusText:
                  created.status === "failed"
                    ? created.statusMessage ?? "Upload failed"
                    : "Ready",
              },
            };
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setNodes((nodesSnapshot) =>
          nodesSnapshot.map((n) =>
            n.id === contextNodeId && n.type === "context"
              ? { ...n, data: { ...n.data, statusText: message } }
              : n,
          ),
        );
      }
    },
    [nodes, params.workspaceId],
  );

  const uploadTextToContextNode = useCallback(
    async (contextNodeId: string, text: string) => {
      const workspaceId = params.workspaceId;
      if (!workspaceId) return;
      try {
        const contextNode = nodes.find(
          (n) => n.id === contextNodeId && n.type === "context",
        );
        const existing = contextNode?.type === "context" && (contextNode.data.assetCount ?? 0) > 0;
        const created = await uploadContextNodeTextAsset({
          workspaceId,
          contextNodeId,
          text,
          replace: existing,
        });
        setNodes((nodesSnapshot) =>
          nodesSnapshot.map((n) => {
            if (n.id !== contextNodeId || n.type !== "context") return n;
            return {
              ...n,
              data: {
                ...n.data,
                title: suggestTitleFromText(text),
                assetCount: 1,
                statusText:
                  created.status === "failed"
                    ? created.statusMessage ?? "Upload failed"
                    : "Ready",
              },
            };
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setNodes((nodesSnapshot) =>
          nodesSnapshot.map((n) =>
            n.id === contextNodeId && n.type === "context"
              ? { ...n, data: { ...n.data, statusText: message } }
              : n,
          ),
        );
      }
    },
    [nodes, params.workspaceId],
  );

  const onNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes) => {
      const workspaceId = params.workspaceId;
      const removedIds = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
      const removedContextNodeIds = new Set(
        nodes
          .filter((n) => removedIds.has(n.id) && n.type === "context")
          .map((n) => n.id),
      );

      if (workspaceId && removedIds.size > 0) {
        const removal = collectCascadeRemoval(nodes, removedIds);
        persistCascadeDeletes({
          workspaceId,
          chatIds: removal.removedChatIds,
          messageIds: removal.removedMessageIds,
        });
        for (const contextNodeId of removedContextNodeIds) {
          void deleteContextNode({ workspaceId, contextNodeId }).catch(() => {});
        }
      }

      setNodes((nodesSnapshot) => {
        const removal = collectCascadeRemoval(nodesSnapshot, removedIds);

        if (removal.removedAllIds.size > 0) {
          setEdges((edgesSnapshot) =>
            edgesSnapshot.filter(
              (e) =>
                !removal.removedAllIds.has(e.source) && !removal.removedAllIds.has(e.target),
            ),
          );
        }

        const next = applyNodeChanges(changes, nodesSnapshot).filter(
          (n) => !(n.type === "message" && n.parentId && removal.removedChatIds.has(n.parentId)),
        );

        return applyAutoLayout(next);
      });
    },
    [nodes, params.workspaceId],
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
    deleteContextNodeById,
    updateContextNodeTitle,
    createContextNodeAt,
    uploadAssetToContextNode,
    uploadTextToContextNode,
    persistLayoutNow,
    onNodesChange,
    onEdgesChange,
    onAutoLayout,
    onEdgeMouseEnter: (_event: MouseEvent, edge: Edge) => setHoveredEdgeId(edge.id),
    onEdgeMouseLeave: () => setHoveredEdgeId(null),
  };
}
