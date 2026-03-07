import { ChevronDown, ChevronRight, Folder, Menu, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

export type PanelWorkspaceItem = {
  id: string;
  title: string;
};

export type PanelChatItem = {
  id: string;
  title: string;
};

type Props = {
  open: boolean;
  workspaces: PanelWorkspaceItem[];
  selectedWorkspaceId: string | null;
  chats: PanelChatItem[];
  onOpen(): void;
  onClose(): void;
  onNodeHover(id: string): void;
  onNodeHoverEnd(): void;
  onNodeClick(id: string): void;
  onWorkspaceSelect(workspaceId: string): void;
  onWorkspaceCreate(): void;
  onWorkspaceRename(workspaceId: string, title: string): void;
  onWorkspaceDelete(workspaceId: string): void;
};

export default function Panel(props: Props) {
  const {
    open,
    workspaces,
    selectedWorkspaceId,
    chats,
    onOpen,
    onClose,
    onNodeHover,
    onNodeHoverEnd,
    onNodeClick,
    onWorkspaceSelect,
    onWorkspaceCreate,
    onWorkspaceRename,
    onWorkspaceDelete,
  } = props;
  const [collapsedSpaceIds, setCollapsedSpaceIds] = useState<Set<string>>(new Set());
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [workspaceTitleDraft, setWorkspaceTitleDraft] = useState("");

  const handleWorkspaceDelete = (workspaceId: string, title: string) => {
    if (!window.confirm(`Delete workspace \"${title}\"?`)) return;
    onWorkspaceDelete(workspaceId);
  };

  const beginWorkspaceEdit = (workspaceId: string, currentTitle: string) => {
    onWorkspaceSelect(workspaceId);
    setEditingWorkspaceId(workspaceId);
    setWorkspaceTitleDraft(currentTitle);
  };

  const commitWorkspaceEdit = (workspaceId: string, currentTitle: string) => {
    const next = workspaceTitleDraft.trim();
    if (!next) {
      setEditingWorkspaceId(null);
      setWorkspaceTitleDraft("");
      return;
    }
    if (next !== currentTitle) onWorkspaceRename(workspaceId, next);
    setEditingWorkspaceId(null);
    setWorkspaceTitleDraft("");
  };

  const cancelWorkspaceEdit = () => {
    setEditingWorkspaceId(null);
    setWorkspaceTitleDraft("");
  };

  const toggleSpaceCollapsed = (workspaceId: string) => {
    setCollapsedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  };

  return (
    <div className="fixed left-4 top-4 bottom-4 z-50" onMouseDown={(e) => e.stopPropagation()}>
      {!open ? (
        <button
          type="button"
          className="group relative flex items-center justify-center rounded-lg border border-transparent bg-transparent p-2 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
          aria-label="Open panel"
          title="Open panel"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          >
          <Menu size={16} className="text-(--panel-muted) group-hover:text-(--panel-fg)" />
        </button>
      ) : (
        <aside className="h-full w-76 overflow-hidden rounded-2xl border border-(--panel-border) bg-(--panel-bg)! text-(--panel-fg) elev-3 backdrop-blur">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-auto px-2 py-3">
              <div className="flex items-center justify-between px-2">
                <div className="text-sm font-semibold text-(--panel-fg)">
                  Spaces
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-transparent p-1 hover:border-(--control-border-hover) hover:bg-(--control-bg-hover) hover:cursor-pointer"
                  aria-label="Close panel"
                  title="Close panel"
                  onClick={() => {
                    onNodeHoverEnd();
                    onClose();
                  }}
                >
                  <X size={16} className="text-(--panel-muted)" />
                </button>
              </div>

              <div className="mt-3 px-2">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg border border-(--control-border) bg-transparent px-2 py-1 text-xs font-medium text-(--control-fg) hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
                  title="Create workspace"
                  onClick={() => onWorkspaceCreate()}
                >
                  <Plus size={12} />
                  <span>New Space</span>
                </button>
              </div>

              <div className="mt-3">
              {workspaces.length === 0 ? (
                <div className="px-2 py-1 text-sm text-(--panel-muted)">No spaces yet.</div>
              ) : (
                <ul className="space-y-2">
                  {workspaces.map((workspace) => {
                    const isSelected = workspace.id === selectedWorkspaceId;
                    const isCollapsed = collapsedSpaceIds.has(workspace.id);
                    return (
                      <li key={workspace.id}>
                        <div
                          className={`flex items-center gap-1 rounded-xl px-2 py-1 ${
                            isSelected
                              ? "bg-(--control-bg-hover)"
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="rounded border border-transparent p-1 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
                            title={isCollapsed ? "Expand space" : "Collapse space"}
                            onClick={() => toggleSpaceCollapsed(workspace.id)}
                            aria-label={isCollapsed ? "Expand space" : "Collapse space"}
                          >
                            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <div className="min-w-0 flex flex-1 items-center gap-2">
                            <Folder size={14} className="shrink-0 text-(--panel-muted)" />
                            {editingWorkspaceId === workspace.id ? (
                              <input
                                className="min-w-0 flex-1 rounded-lg border border-(--control-border) bg-(--control-bg) px-2 py-1 text-sm text-(--control-fg) focus:outline-none focus:ring-2 focus:ring-(--focus-ring)"
                                value={workspaceTitleDraft}
                                onChange={(e) => setWorkspaceTitleDraft(e.target.value)}
                                onBlur={() => commitWorkspaceEdit(workspace.id, workspace.title)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitWorkspaceEdit(workspace.id, workspace.title);
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelWorkspaceEdit();
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                className="min-w-0 flex-1 truncate text-left text-sm hover:cursor-text"
                                onClick={() => beginWorkspaceEdit(workspace.id, workspace.title)}
                                title={`Rename ${workspace.title}`}
                              >
                                <span className="truncate">{workspace.title}</span>
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            className="rounded border border-transparent p-1 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
                            title="Delete workspace"
                            onClick={() => handleWorkspaceDelete(workspace.id, workspace.title)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {isSelected && !isCollapsed ? (
                          chats.length === 0 ? (
                            <div className="ml-5 mt-1 px-2 py-1 text-sm text-(--panel-muted)">No chats yet.</div>
                          ) : (
                            <ul className="ml-5 mt-1 space-y-1 border-l border-(--panel-border) pl-3">
                              {chats.map((chat) => (
                                <li key={chat.id}>
                                  <button
                                    type="button"
                                    className="w-full rounded-xl border border-transparent px-2 py-1 text-left text-sm text-(--panel-fg) hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover) focus:outline-none focus:ring-2 focus:ring-(--focus-ring)"
                                    title={chat.title}
                                    onMouseEnter={() => onNodeHover(chat.id)}
                                    onMouseLeave={() => onNodeHoverEnd()}
                                    onFocus={() => onNodeHover(chat.id)}
                                    onBlur={() => onNodeHoverEnd()}
                                    onClick={() => onNodeClick(chat.id)}
                                  >
                                    <div className="truncate">{chat.title}</div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
