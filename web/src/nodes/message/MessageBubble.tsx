import { NodeDeleteButton } from '../../ui/NodeDeleteButton'

type MessageBubbleProps = {
  text: string
  role: 'user' | 'app'
  onDelete: () => void
}

export function MessageBubble({ text, role, onDelete }: MessageBubbleProps) {
  return (
    <div className={`message-bubble message-${role}`}>
      <div className="message-meta">{role === 'user' ? 'You' : 'App'}</div>
      <div className="message-text">{text}</div>
      <NodeDeleteButton className="message-delete" label="Delete" onClick={onDelete} />
    </div>
  )
}
