import { Menu, Pencil, Plus, Trash2, X } from "lucide-react";

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

  const handleWorkspaceRename = (workspaceId: string, currentTitle: string) => {
    const next = window.prompt("Rename workspace", currentTitle)?.trim();
    if (!next) return;
    onWorkspaceRename(workspaceId, next);
  };

  const handleWorkspaceDelete = (workspaceId: string, title: string) => {
    if (!window.confirm(`Delete workspace \"${title}\"?`)) return;
    onWorkspaceDelete(workspaceId);
  };

  return (
    <div className="fixed left-4 top-4 z-50" onMouseDown={(e) => e.stopPropagation()}>
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
        <aside className="w-72 overflow-hidden rounded-2xl border border-(--panel-border) bg-(--panel-bg)! text-(--panel-fg) elev-3 backdrop-blur">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <div className="flex items-center justify-between border-b border-(--panel-border) px-3 py-2">
              <div className="text-sm font-medium">Navigation</div>
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

            <div className="overflow-auto px-2 py-2">
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between px-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-(--panel-muted)">
                    Workspaces
                  </div>
                  <button
                    type="button"
                    className="rounded border border-transparent p-1 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
                    title="Create workspace"
                    onClick={() => onWorkspaceCreate()}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {workspaces.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-(--panel-muted)">No workspaces yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {workspaces.map((workspace) => {
                      const isSelected = workspace.id === selectedWorkspaceId;
                      return (
                        <li key={workspace.id}>
                          <div
                            className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${
                              isSelected
                                ? "border-(--control-border-hover) bg-(--control-bg-hover)"
                                : "border-transparent"
                            }`}
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left text-sm hover:cursor-pointer"
                              onClick={() => onWorkspaceSelect(workspace.id)}
                              title={workspace.title}
                            >
                              {workspace.title}
                            </button>
                            <button
                              type="button"
                              className="rounded border border-transparent p-1 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
                              title="Rename workspace"
                              onClick={() => handleWorkspaceRename(workspace.id, workspace.title)}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              className="rounded border border-transparent p-1 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
                              title="Delete workspace"
                              onClick={() => handleWorkspaceDelete(workspace.id, workspace.title)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-(--panel-muted)">
                  Chats
                </div>
                {chats.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-(--panel-muted)">No chats yet.</div>
                ) : (
                  <ul className="space-y-1">
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
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
