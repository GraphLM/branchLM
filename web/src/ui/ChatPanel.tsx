import { Menu, X } from 'lucide-react'
import { composeButtonClass } from './buttonStyles'

export type ChatPanelItem = {
  id: string
  title: string
}

type ChatPanelProps = {
  open: boolean
  chats: ChatPanelItem[]
  onOpen: () => void
  onClose: () => void
  onChatClick: (id: string) => void
}

export function ChatPanel({ open, chats, onOpen, onClose, onChatClick }: ChatPanelProps) {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-30" onPointerDown={(event) => event.stopPropagation()}>
      {!open ? (
        <button
          aria-label="Open chat panel"
          className={composeButtonClass({ variant: 'primary', size: 'icon' })}
          onClick={() => onOpen()}
          title="Open chat panel"
          type="button"
        >
          <Menu className="h-4 w-4" />
        </button>
      ) : (
        <aside className="w-64 overflow-hidden rounded-2xl border border-[color:var(--color-panel-border)] bg-[color:var(--color-panel)]/92 p-2 text-[color:var(--color-text-primary)] shadow-[0_16px_34px_var(--color-chat-shadow)] backdrop-blur">
          <div className="flex items-center justify-between border-b border-[color:var(--color-panel-border)] px-2 pb-2">
            <h2 className="text-sm font-semibold tracking-wide">Chats</h2>
            <button
              aria-label="Close chat panel"
              className={composeButtonClass({
                variant: 'primary',
                size: 'icon',
                className: 'h-8 w-8',
              })}
              onClick={() => onClose()}
              title="Close chat panel"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-auto pt-2">
            {chats.length === 0 ? (
              <div className="rounded-lg border border-[color:var(--color-panel-border)] bg-[color:var(--color-canvas-base)]/60 px-3 py-2 text-sm text-[color:var(--color-text-secondary)]">
                No chats yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <button
                      className={composeButtonClass({
                        variant: 'primary',
                        size: 'chip',
                        className: 'w-full justify-start rounded-lg px-3 text-left text-sm normal-case tracking-normal',
                      })}
                      onClick={() => onChatClick(chat.id)}
                      title={chat.title}
                      type="button"
                    >
                      <span className="truncate">{chat.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
