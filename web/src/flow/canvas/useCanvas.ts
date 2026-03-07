import { useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { FlowActions } from "../actionsContext";
import { useConnections } from "../connections/useConnections";
import { useGraph } from "../graph/useGraph";
import { useMessaging } from "../messaging/useMessaging";
import { usePanel } from "../panel/usePanel";
import type { UseCanvasResult } from "./canvasModel";

export function useCanvas(): UseCanvasResult {
  const { screenToFlowPosition, getNode, setCenter, fitView } = useReactFlow();
  const [composerDraft, setComposerDraft] = useState("");

  const graph = useGraph({ fitView });

  const connections = useConnections({
    nodes: graph.nodes,
    setNodes: graph.setNodes,
    setEdges: graph.setEdges,
    screenToFlowPosition,
  });

  const messaging = useMessaging({
    nodes: graph.nodes,
    composerDraft,
    setComposerDraft,
    setNodes: graph.setNodes,
    screenToFlowPosition,
  });

  const panel = usePanel({
    nodes: graph.nodes,
    pendingSourceMessageId: connections.pendingSourceMessageId,
    onChatTargetHandleActivate: connections.onChatTargetHandleActivate,
    onMessageSourceHandleActivate: connections.onMessageSourceHandleActivate,
    getNode,
    setCenter,
  });

  const actions = useMemo<FlowActions>(
    () => ({
      deleteChat: graph.deleteChatById,
      updateChatTitle: messaging.updateChatTitle,
      updateChatDraft: messaging.updateChatDraft,
      sendChatMessage: messaging.sendChatMessage,
      deleteMessage: graph.deleteMessageById,
    }),
    [
      graph.deleteChatById,
      graph.deleteMessageById,
      messaging.sendChatMessage,
      messaging.updateChatDraft,
      messaging.updateChatTitle,
    ],
  );

  return {
    nodes: graph.nodes,
    renderedEdges: graph.renderedEdges,
    composerDraft,
    panelOpen: panel.panelOpen,
    chatsForPanel: panel.chatsForPanel,
    isLocked: graph.isLocked,
    actions,
    nodeTypes: panel.nodeTypes,
    setComposerDraft,
    onNodesChange: graph.onNodesChange,
    onEdgesChange: graph.onEdgesChange,
    onConnect: connections.onConnect,
    onConnectStart: connections.onConnectStart,
    onConnectEnd: connections.onConnectEnd,
    onPaneClick: connections.onPaneClick,
    onEdgeMouseEnter: graph.onEdgeMouseEnter,
    onEdgeMouseLeave: graph.onEdgeMouseLeave,
    onAutoLayout: graph.onAutoLayout,
    onLockToggle: () => graph.setIsLocked((prev) => !prev),
    onPanelOpen: panel.onPanelOpen,
    onPanelClose: panel.onPanelClose,
    onPanelNodeHover: panel.onPanelNodeHover,
    onPanelNodeHoverEnd: panel.onPanelNodeHoverEnd,
    onPanelNodeClick: panel.onPanelNodeClick,
    sendComposerMessage: messaging.sendComposerMessage,
  };
}
