import type { ButtonHTMLAttributes } from 'react'
import { Trash2 } from 'lucide-react'

type NodeDeleteButtonProps = {
  label?: string
  showIcon?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export function NodeDeleteButton({ label = 'Delete', showIcon = true, ...props }: NodeDeleteButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger-text)] transition hover:brightness-110 ${props.className ?? ''}`.trim()}
      type="button"
    >
      {showIcon ? <Trash2 size={13} strokeWidth={2.1} /> : null}
    </button>
  )
}
