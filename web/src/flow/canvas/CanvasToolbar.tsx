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
import { useRef, useState } from "react";

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
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const openNodeMenu = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (primaryMode === "new-chat") {
      setShowNodeMenu(true);
    }
  };

  const scheduleCloseNodeMenu = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setShowNodeMenu(false);
      closeTimerRef.current = null;
    }, 320);
  };

  return (
    <Panel position="bottom-center" className="mb-6">
      <div
        className="relative flex items-center gap-1 rounded-xl border border-(--panel-border) bg-(--panel-bg) p-1 elev-2 backdrop-blur"
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
        <div
          className="relative"
          onMouseEnter={openNodeMenu}
          onMouseLeave={scheduleCloseNodeMenu}
        >
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
        {primaryMode === "new-chat" && showNodeMenu ? (
          <div
            className="absolute left-full top-0 -ml-px h-full rounded-r-xl rounded-l-none border border-(--panel-border) bg-(--panel-bg) p-1 elev-2"
            onMouseEnter={openNodeMenu}
            onMouseLeave={scheduleCloseNodeMenu}
          >
            <button
              type="button"
              className="group relative flex h-full items-center justify-center rounded-md px-2 hover:cursor-pointer hover:bg-(--control-bg-hover)"
              onClick={() => {
                onAddContextNode();
                setShowNodeMenu(false);
              }}
              title="Context node"
            >
              <FilePlus2 size={14} />
              <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-(--panel-border) bg-(--panel-bg) px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                Context node
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
