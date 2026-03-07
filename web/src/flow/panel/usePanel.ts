import { useCallback, useMemo, useState } from "react";
import type { AppNode } from "../types";
import { createNodeTypes, focusNodeInView } from "./panelModel";

export function usePanel(params: {
  nodes: AppNode[];
  pendingSourceMessageId: string | null;
  onChatTargetHandleActivate: (chatId: string) => void;
  onMessageSourceHandleActivate: (messageId: string) => void;
  getNode: (id: string) =>
    | ({
        measured?: { width?: number; height?: number };
        width?: number;
        height?: number;
        position: { x: number; y: number };
      } & Record<string, unknown>)
    | undefined;
  setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodeTypes = useMemo(
    () =>
      createNodeTypes({
        hoveredNodeId,
        pendingSourceMessageId: params.pendingSourceMessageId,
        onChatTargetHandleActivate: params.onChatTargetHandleActivate,
        onMessageSourceHandleActivate: params.onMessageSourceHandleActivate,
      }),
    [
      hoveredNodeId,
      params.pendingSourceMessageId,
      params.onChatTargetHandleActivate,
      params.onMessageSourceHandleActivate,
    ],
  );

  const chatsForPanel = useMemo(() => {
    return params.nodes
      .filter((n) => n.type === "chat")
      .map((n) => ({ id: n.id, title: n.data.title }));
  }, [params.nodes]);

  const onPanelNodeClick = useCallback(
    (id: string) => {
      focusNodeInView({ getNode: params.getNode, setCenter: params.setCenter, nodeId: id });
    },
    [params],
  );

  return {
    panelOpen,
    chatsForPanel,
    nodeTypes,
    onPanelOpen: () => setPanelOpen(true),
    onPanelClose: () => {
      setHoveredNodeId(null);
      setPanelOpen(false);
    },
    onPanelNodeHover: (id: string) => setHoveredNodeId(id),
    onPanelNodeHoverEnd: () => setHoveredNodeId(null),
    onPanelNodeClick,
  };
}
