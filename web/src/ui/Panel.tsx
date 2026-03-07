import { Menu, X } from "lucide-react";

export type PanelChatItem = {
  id: string;
  title: string;
};

type Props = {
  open: boolean;
  chats: PanelChatItem[];
  onOpen(): void;
  onClose(): void;
  onNodeHover(id: string): void;
  onNodeHoverEnd(): void;
  onNodeClick(id: string): void;
};

export default function Panel(props: Props) {
  const { open, chats, onOpen, onClose, onNodeHover, onNodeHoverEnd, onNodeClick } =
    props;

  return (
    <div
      className="fixed left-4 top-4 z-50"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!open ? (
        <button
          type="button"
          className="group relative flex items-center justify-center rounded-md border border-transparent bg-transparent p-2 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
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
          <Menu
            size={16}
            className="text-(--panel-muted) group-hover:text-(--panel-fg)"
          />
        </button>
      ) : (
        <aside className="w-60 overflow-hidden rounded-md border border-(--panel-border) bg-(--panel-bg)! text-(--panel-fg) elev-3 backdrop-blur">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <div className="flex items-center justify-between border-b border-(--panel-border) px-3 py-2">
              <div className="text-sm font-medium">Chats</div>
              <button
                type="button"
                className="rounded-md border border-transparent p-1 hover:border-(--control-border-hover) hover:bg-(--control-bg-hover) hover:cursor-pointer"
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
              {chats.length === 0 ? (
                <div className="px-2 py-2 text-sm text-(--panel-muted)">
                  No chats yet.
                </div>
              ) : (
                <ul className="space-y-1">
                  {chats.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full rounded-md border border-transparent px-2 py-1 text-left text-sm text-(--panel-fg) hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover) focus:outline-none focus:ring-2 focus:ring-(--focus-ring)"
                        title={c.title}
                        onMouseEnter={() => onNodeHover(c.id)}
                        onMouseLeave={() => onNodeHoverEnd()}
                        onFocus={() => onNodeHover(c.id)}
                        onBlur={() => onNodeHoverEnd()}
                        onClick={() => onNodeClick(c.id)}
                      >
                        <div className="truncate">{c.title}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
