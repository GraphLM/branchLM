import { Panel, useReactFlow } from "@xyflow/react";
import {
  FilePlus2,
  LayoutGrid,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  Plus,
  SendHorizontal,
  SquarePen,
} from "lucide-react";

type Props = {
  onAutoLayout: () => void;
  onAddContextNode: () => void;
  locked: boolean;
  onLockToggle: () => void;
  primaryMode: "send" | "new-chat";
  onPrimaryAction: () => void;
};

const buttonBase =
  "group relative flex items-center justify-center rounded-lg border border-transparent bg-transparent p-2 transition-colors hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover) focus:outline-none focus:ring-2 focus:ring-(--focus-ring)";

export default function CanvasToolbar({
  onAutoLayout,
  onAddContextNode,
  locked,
  onLockToggle,
  primaryMode,
  onPrimaryAction,
}: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-center" className="mb-6">
      <div
        className="flex items-center gap-1 rounded-2xl border border-(--panel-border) bg-(--panel-bg) p-1 elev-2 backdrop-blur"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={buttonBase}
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => zoomIn({ duration: 200 })}
        >
          <Plus size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
        </button>
        <button
          type="button"
          className={buttonBase}
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => zoomOut({ duration: 200 })}
        >
          <Minus size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
        </button>
        <button
          type="button"
          className={buttonBase}
          aria-label="Center view"
          title="Center view"
          onClick={() => fitView({ duration: 200, padding: 0.2 })}
        >
          <Maximize2 size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
        </button>
        <button
          type="button"
          className={buttonBase}
          aria-label="Auto layout"
          title="Auto layout"
          onClick={onAutoLayout}
        >
          <LayoutGrid size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
        </button>
        <button
          type="button"
          className={buttonBase}
          aria-label="Create context node"
          title="Create context node"
          onClick={onAddContextNode}
        >
          <FilePlus2 size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
        </button>
        <button
          type="button"
          className={buttonBase}
          aria-label={locked ? "Unlock canvas" : "Lock canvas"}
          title={locked ? "Unlock canvas" : "Lock canvas"}
          onClick={onLockToggle}
        >
          {locked ? (
            <Lock size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
          ) : (
            <LockOpen size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
          )}
        </button>
        <div className="mx-1 h-6 w-px bg-(--panel-border)" />
        <button
          type="button"
          className={buttonBase}
          aria-label={primaryMode === "send" ? "Send message" : "Create chat"}
          title={primaryMode === "send" ? "Send message" : "Create chat"}
          onClick={onPrimaryAction}
        >
          {primaryMode === "send" ? (
            <SendHorizontal size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
          ) : (
            <SquarePen size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
          )}
        </button>
      </div>
    </Panel>
  );
}
