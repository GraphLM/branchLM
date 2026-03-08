import { useCallback, useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { FlowActions } from "../actionsContext";
import { useConnections } from "../connections/useConnections";
import { useGraph } from "../graph/useGraph";
import { useMessaging } from "../messaging/useMessaging";
import { usePanel } from "../panel/usePanel";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspaceTitle,
  type WorkspaceDTO,
} from "../workspaces/workspaceApi";
import type { UseCanvasResult } from "./canvasModel";

function getWorkspaceIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("workspaceId");
}

function setWorkspaceIdInUrl(workspaceId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("workspaceId", workspaceId);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function chooseWorkspaceAfterDelete(params: {
  deletedWorkspaceId: string;
  workspaces: WorkspaceDTO[];
}): string | null {
  const remaining = params.workspaces.filter((w) => w.id !== params.deletedWorkspaceId);
  return remaining.length > 0 ? remaining[0].id : null;
}

export function useCanvas(): UseCanvasResult {
  const { screenToFlowPosition, getNode, setCenter, fitView } = useReactFlow();
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let nextWorkspaces = (await listWorkspaces()) ?? [];
      if (cancelled) return;

      if (nextWorkspaces.length === 0) {
        const created = await createWorkspace({ title: "Untitled workspace" });
        if (!created || cancelled) return;
        nextWorkspaces = [created];
      }

      const urlWorkspaceId = getWorkspaceIdFromUrl();
      const selected =
        (urlWorkspaceId && nextWorkspaces.find((w) => w.id === urlWorkspaceId)?.id) ??
        nextWorkspaces[0].id;

      setWorkspaces(nextWorkspaces);
      setSelectedWorkspaceId(selected);
      setWorkspaceIdInUrl(selected);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const graph = useGraph({ workspaceId: selectedWorkspaceId, fitView });

  const connections = useConnections({
    workspaceId: selectedWorkspaceId ?? "",
    nodes: graph.nodes,
    setNodes: graph.setNodes,
    setEdges: graph.setEdges,
    screenToFlowPosition,
  });

  const messaging = useMessaging({
    workspaceId: selectedWorkspaceId ?? "",
    nodes: graph.nodes,
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

  const onWorkspaceSelect = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setWorkspaceIdInUrl(workspaceId);
  }, []);

  const onWorkspaceCreate = useCallback(async () => {
    const created = await createWorkspace({ title: "Untitled workspace" });
    if (!created) return;

    setWorkspaces((prev) => prev.concat(created));
    setSelectedWorkspaceId(created.id);
    setWorkspaceIdInUrl(created.id);
  }, []);

  const onWorkspaceRename = useCallback((workspaceId: string, title: string) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? { ...w, title } : w)));
    updateWorkspaceTitle({ workspaceId, title }).catch(() => {});
  }, []);

  const onWorkspaceDelete = useCallback(
    async (workspaceId: string) => {
      try {
        await deleteWorkspace({ workspaceId });
      } catch {
        return;
      }

      const remainingId = chooseWorkspaceAfterDelete({
        deletedWorkspaceId: workspaceId,
        workspaces,
      });

      if (remainingId) {
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
        if (selectedWorkspaceId === workspaceId) {
          setSelectedWorkspaceId(remainingId);
          setWorkspaceIdInUrl(remainingId);
        }
        return;
      }

      const created = await createWorkspace({ title: "Untitled workspace" });
      if (!created) return;

      setWorkspaces([created]);
      setSelectedWorkspaceId(created.id);
      setWorkspaceIdInUrl(created.id);
    },
    [selectedWorkspaceId, workspaces],
  );

  const actions = useMemo<FlowActions>(
    () => ({
      deleteChat: graph.deleteChatById,
      updateChatTitle: messaging.updateChatTitle,
      updateChatDraft: messaging.updateChatDraft,
      sendChatMessage: (chatId: string) => {
        void (async () => {
          try {
            await graph.persistLayoutNow();
          } catch {
            // If layout save fails, generation likely misses latest context links.
            return;
          }
          await messaging.sendChatMessage(chatId);
        })();
      },
      deleteMessage: graph.deleteMessageById,
      deleteContextNode: graph.deleteContextNodeById,
      uploadContextAsset: graph.uploadAssetToContextNode,
      uploadContextText: graph.uploadTextToContextNode,
    }),
    [
      graph.deleteChatById,
      graph.deleteContextNodeById,
      graph.deleteMessageById,
      graph.persistLayoutNow,
      graph.uploadAssetToContextNode,
      graph.uploadTextToContextNode,
      messaging.sendChatMessage,
      messaging.updateChatDraft,
      messaging.updateChatTitle,
    ],
  );

  const selectedChat = useMemo(
    () => graph.nodes.find((n) => n.type === "chat" && n.selected),
    [graph.nodes],
  );
  const toolbarPrimaryMode: "send" | "new-chat" =
    selectedChat && selectedChat.type === "chat" && selectedChat.data.draft.trim().length > 0
      ? "send"
      : "new-chat";

  return {
    nodes: graph.nodes,
    renderedEdges: graph.renderedEdges,
    selectedWorkspaceId,
    workspacesForPanel: workspaces,
    panelOpen: panel.panelOpen,
    chatsForPanel: panel.chatsForPanel,
    isLocked: graph.isLocked,
    toolbarPrimaryMode,
    actions,
    nodeTypes: panel.nodeTypes,
    onNodesChange: graph.onNodesChange,
    onEdgesChange: graph.onEdgesChange,
    onConnect: connections.onConnect,
    onConnectStart: connections.onConnectStart,
    onConnectEnd: connections.onConnectEnd,
    onPaneClick: connections.onPaneClick,
    onEdgeMouseEnter: graph.onEdgeMouseEnter,
    onEdgeMouseLeave: graph.onEdgeMouseLeave,
    onAutoLayout: graph.onAutoLayout,
    onAddContextNode: () => {
      if (!selectedWorkspaceId) return;
      void graph.createContextNodeAt(
        screenToFlowPosition({
          x: window.innerWidth / 2 + 100,
          y: window.innerHeight / 2 - 100,
        }),
      );
    },
    onLockToggle: () => graph.setIsLocked((prev) => !prev),
    onPanelOpen: panel.onPanelOpen,
    onPanelClose: panel.onPanelClose,
    onPanelNodeHover: panel.onPanelNodeHover,
    onPanelNodeHoverEnd: panel.onPanelNodeHoverEnd,
    onPanelNodeClick: panel.onPanelNodeClick,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceRename,
    onWorkspaceDelete,
    onToolbarPrimaryAction: () => {
      if (!selectedWorkspaceId) return;
      if (selectedChat?.type === "chat" && selectedChat.data.draft.trim().length > 0) {
        void (async () => {
          try {
            await graph.persistLayoutNow();
          } catch {
            return;
          }
          await messaging.sendChatMessage(selectedChat.id);
        })();
        return;
      }
      if (selectedChat?.type === "chat") {
        messaging.focusChatDraft(selectedChat.id);
        return;
      }
      void messaging.createChatDraft();
    },
  };
}
