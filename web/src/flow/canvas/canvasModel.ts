import type { Edge, NodeProps, OnConnect, OnConnectEnd, OnConnectStart, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import type { MouseEvent, ReactElement } from "react";
import type { FlowActions } from "../actionsContext";
import type {
  AppNode,
  ChatNode as ChatFlowNode,
  ContextNode as ContextFlowNode,
  MessageNode as MessageFlowNode,
} from "../types";

export type UseCanvasResult = {
  nodes: AppNode[];
  renderedEdges: Edge[];
  composerDraft: string;
  selectedWorkspaceId: string | null;
  workspacesForPanel: Array<{ id: string; title: string }>;
  panelOpen: boolean;
  chatsForPanel: Array<{ id: string; title: string }>;
  isLocked: boolean;
  actions: FlowActions;
  nodeTypes: {
    chat: (props: NodeProps<ChatFlowNode>) => ReactElement;
    context: (props: NodeProps<ContextFlowNode>) => ReactElement;
    message: (props: NodeProps<MessageFlowNode>) => ReactElement;
  };
  setComposerDraft: (value: string) => void;
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  onPaneClick: () => void;
  onEdgeMouseEnter: (_event: MouseEvent, edge: Edge) => void;
  onEdgeMouseLeave: () => void;
  onAutoLayout: () => void;
  onAddContextNode: () => void;
  onLockToggle: () => void;
  onPanelOpen: () => void;
  onPanelClose: () => void;
  onPanelNodeHover: (id: string) => void;
  onPanelNodeHoverEnd: () => void;
  onPanelNodeClick: (id: string) => void;
  onWorkspaceSelect: (workspaceId: string) => void;
  onWorkspaceCreate: () => void;
  onWorkspaceRename: (workspaceId: string, title: string) => void;
  onWorkspaceDelete: (workspaceId: string) => void;
  sendComposerMessage: () => void;
};
