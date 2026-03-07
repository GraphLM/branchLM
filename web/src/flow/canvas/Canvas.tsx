import { Background, BackgroundVariant, MarkerType, Panel as FlowPanel, ReactFlow } from "@xyflow/react";
import { LogOut } from "lucide-react";
import "@xyflow/react/dist/style.css";
import Panel from "../../ui/Panel";
import { FlowActionsProvider } from "../actionsContext";
import CanvasToolbar from "./CanvasToolbar";
import { useCanvas } from "./useCanvas";

type Props = {
  onLogout: () => void;
};

export default function Canvas({ onLogout }: Props) {
  const canvas = useCanvas();

  return (
    <div className="w-screen h-screen">
      <FlowActionsProvider value={canvas.actions}>
        {canvas.chatsForPanel.length === 0 ? (
          <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center px-4">
            <div className="max-w-sm rounded-xl border border-(--panel-border) bg-(--panel-bg) elev-2 p-4 text-center backdrop-blur">
              <p className="text-sm text-(--panel-fg)">No chats yet</p>
              <p className="mt-1 text-xs text-(--panel-muted)">
                Create your first chat from the toolbar at the bottom.
              </p>
            </div>
          </div>
        ) : null}

        <Panel
          open={canvas.panelOpen}
          workspaces={canvas.workspacesForPanel}
          selectedWorkspaceId={canvas.selectedWorkspaceId}
          chats={canvas.chatsForPanel}
          onOpen={canvas.onPanelOpen}
          onClose={canvas.onPanelClose}
          onNodeHover={canvas.onPanelNodeHover}
          onNodeHoverEnd={canvas.onPanelNodeHoverEnd}
          onNodeClick={canvas.onPanelNodeClick}
          onWorkspaceSelect={canvas.onWorkspaceSelect}
          onWorkspaceCreate={canvas.onWorkspaceCreate}
          onWorkspaceRename={canvas.onWorkspaceRename}
          onWorkspaceDelete={canvas.onWorkspaceDelete}
        />

        <ReactFlow
          nodes={canvas.nodes}
          edges={canvas.renderedEdges}
          onNodesChange={canvas.onNodesChange}
          onEdgesChange={canvas.onEdgesChange}
          onConnect={canvas.onConnect}
          onConnectStart={canvas.onConnectStart}
          onConnectEnd={canvas.onConnectEnd}
          onPaneClick={canvas.onPaneClick}
          onEdgeMouseEnter={canvas.onEdgeMouseEnter}
          onEdgeMouseLeave={canvas.onEdgeMouseLeave}
          nodeTypes={canvas.nodeTypes}
          fitView
          nodesDraggable={!canvas.isLocked}
          style={{ backgroundColor: "var(--canvas-bg)" }}
          defaultEdgeOptions={{
            style: { stroke: "var(--flow-edge-stroke)" },
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          connectionLineStyle={{ stroke: "var(--flow-edge-stroke)" }}
          deleteKeyCode={["Backspace", "Delete"]}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1.5}
            color="var(--flow-grid-dots)"
          />
          <CanvasToolbar
            onAutoLayout={canvas.onAutoLayout}
            locked={canvas.isLocked}
            onLockToggle={canvas.onLockToggle}
            primaryMode={canvas.toolbarPrimaryMode}
            onPrimaryAction={canvas.onToolbarPrimaryAction}
          />
          <FlowPanel position="top-right" className="mt-4 mr-4">
            <button
              type="button"
              className="group relative flex items-center justify-center rounded-lg border border-transparent bg-transparent p-2 transition-colors hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover) focus:outline-none focus:ring-2 focus:ring-(--focus-ring)"
              aria-label="Log out"
              title="Log out"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
            >
              <LogOut size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
            </button>
          </FlowPanel>
        </ReactFlow>
      </FlowActionsProvider>
    </div>
  );
}
