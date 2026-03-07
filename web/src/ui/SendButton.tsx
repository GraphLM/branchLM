import type { ButtonHTMLAttributes } from 'react'

type SendButtonProps = {
  label?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function SendButton({ label = 'Send', ...props }: SendButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-lg border border-[color:var(--color-control-bg)] bg-[color:var(--color-control-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--color-control-text)] shadow-sm transition hover:border-[color:var(--color-control-bg-hover)] hover:bg-[color:var(--color-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-55 ${props.className ?? ''}`.trim()}
      type="button"
    >
      {label}
    </button>
  )
}
