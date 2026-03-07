import type { FormEvent } from 'react'

import { NodeDeleteButton } from '../../ui/NodeDeleteButton'
import { SendButton } from '../../ui/SendButton'

type ChatCardProps = {
  chatId: string
  title: string
  draft: string
  onUpdateTitle: (chatId: string, title: string) => void
  onUpdateDraft: (chatId: string, draft: string) => void
  onSendMessage: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
}

export function ChatCard({
  chatId,
  title,
  draft,
  onUpdateTitle,
  onUpdateDraft,
  onSendMessage,
  onDeleteChat,
}: ChatCardProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSendMessage(chatId)
  }

  return (
    <div className="flex h-full w-full flex-col justify-between gap-3 rounded-2xl border border-[color:var(--color-chat-border)] bg-[linear-gradient(160deg,var(--color-panel)_0%,#121f34_100%)] p-3 shadow-[0_10px_28px_var(--color-chat-shadow)]">
      <div className="flex items-center gap-2">
        <input
          className="nodrag w-full rounded-lg border border-[color:var(--color-input-border)] bg-[color:var(--color-input-bg)] px-3 py-2 text-sm font-medium text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-secondary)] focus:border-[color:var(--color-control-bg)]"
          onChange={(event) => onUpdateTitle(chatId, event.target.value)}
          placeholder="Chat title"
          value={title}
        />
        <NodeDeleteButton label="Delete" onClick={() => onDeleteChat(chatId)} />
      </div>

      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          className="nodrag w-full rounded-lg border border-[color:var(--color-input-border)] bg-[color:var(--color-input-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-secondary)] focus:border-[color:var(--color-control-bg)]"
          onChange={(event) => onUpdateDraft(chatId, event.target.value)}
          placeholder="Message draft"
          value={draft}
        />
        <SendButton disabled={!draft.trim()} label="Send" type="submit" />
      </form>
    </div>
  )
}
