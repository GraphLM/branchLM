import type { ButtonHTMLAttributes } from 'react'

type NodeDeleteButtonProps = {
  label?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function NodeDeleteButton({ label = 'Delete', ...props }: NodeDeleteButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`rounded-lg border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-bg)] px-2 py-1 text-xs font-medium text-[color:var(--color-danger-text)] transition hover:brightness-110 ${props.className ?? ''}`.trim()}
      type="button"
    >
      {label}
    </button>
  )
}
