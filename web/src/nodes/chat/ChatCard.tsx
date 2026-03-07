import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { NodeDeleteButton } from '../../ui/NodeDeleteButton'
import { SendButton } from '../../ui/SendButton'
import { composeButtonClass } from '../../ui/buttonStyles'

type ChatCardProps = {
  chatId: string
  title: string
  draft: string
  onUpdateTitle: (chatId: string, title: string) => void
  onUpdateDraft: (chatId: string, draft: string) => void
  onSendMessage: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
  targetHandle?: ReactNode
}

export function ChatCard({
  chatId,
  title,
  draft,
  onUpdateTitle,
  onUpdateDraft,
  onSendMessage,
  onDeleteChat,
  targetHandle,
}: ChatCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editableTitle, setEditableTitle] = useState(title)

  useEffect(() => {
    setEditableTitle(title)
  }, [title])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSendMessage(chatId)
  }

  const commitTitle = () => {
    onUpdateTitle(chatId, editableTitle.trim())
    setIsEditingTitle(false)
  }

  return (
    <div className="relative h-full w-full">
      {targetHandle}
      <div className="absolute -top-4 left-3 right-3 z-20 flex items-center justify-between">
        {isEditingTitle ? (
          <input
            autoFocus
            className="nodrag w-28 rounded-full border border-[color:var(--color-input-border)] bg-[color:var(--color-canvas-base)]/95 px-3 py-1 text-xs font-semibold tracking-wide text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-control-bg)]"
            onBlur={commitTitle}
            onChange={(event) => setEditableTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTitle()
              }
              if (event.key === 'Escape') {
                setEditableTitle(title)
                setIsEditingTitle(false)
              }
            }}
            value={editableTitle}
          />
        ) : (
          <button
            className={composeButtonClass({
              variant: 'primary',
              size: 'chip',
            })}
            onClick={() => setIsEditingTitle(true)}
            type="button"
          >
            {title}
          </button>
        )}
        <NodeDeleteButton label="Delete" onClick={() => onDeleteChat(chatId)} />
      </div>

      <form
        className="flex h-full w-full items-end gap-2 rounded-2xl border border-[color:var(--color-chat-border)] bg-[linear-gradient(160deg,var(--color-panel)_0%,#121f34_100%)] p-3 pt-8 shadow-[0_10px_28px_var(--color-chat-shadow)]"
        onSubmit={handleSubmit}
      >
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
