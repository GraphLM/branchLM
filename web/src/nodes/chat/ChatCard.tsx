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
    <div className="chat-card">
      <div className="chat-card-header">
        <input
          className="chat-title-input nodrag"
          onChange={(event) => onUpdateTitle(chatId, event.target.value)}
          placeholder="Chat title"
          value={title}
        />
        <NodeDeleteButton label="Delete" onClick={() => onDeleteChat(chatId)} />
      </div>

      <form className="chat-draft-row" onSubmit={handleSubmit}>
        <input
          className="chat-draft-input nodrag"
          onChange={(event) => onUpdateDraft(chatId, event.target.value)}
          placeholder="Message draft"
          value={draft}
        />
        <SendButton disabled={!draft.trim()} label="Send" type="submit" />
      </form>
    </div>
  )
}
