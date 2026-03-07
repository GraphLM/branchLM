import { NodeDeleteButton } from '../../ui/NodeDeleteButton'

type MessageBubbleProps = {
  text: string
  role: 'user' | 'app'
  onDelete: () => void
}

export function MessageBubble({ text, role, onDelete }: MessageBubbleProps) {
  const containerClass =
    role === 'user'
      ? 'border-[color:var(--color-message-user-border)] bg-[color:var(--color-message-user)]'
      : 'border-[color:var(--color-message-app-border)] bg-[color:var(--color-message-app)]'

  return (
    <div className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border px-3 py-2 ${containerClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)]">
        {role === 'user' ? 'You' : 'App'}
      </div>
      <div className="truncate text-sm text-[color:var(--color-text-primary)]">{text}</div>
      <NodeDeleteButton className="justify-self-end" label="Delete" onClick={onDelete} />
    </div>
  )
}
