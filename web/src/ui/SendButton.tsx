import type { ButtonHTMLAttributes } from 'react'
import { SendHorizontal } from 'lucide-react'

type SendButtonProps = {
  label?: string
  showIcon?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export function SendButton({ label = 'Send', showIcon = true, ...props }: SendButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--color-control-bg)] bg-[color:var(--color-control-bg)] text-[color:var(--color-control-text)] shadow-sm transition hover:border-[color:var(--color-control-bg-hover)] hover:bg-[color:var(--color-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-55 ${props.className ?? ''}`.trim()}
      type="button"
    >
      {showIcon ? <SendHorizontal size={15} strokeWidth={2.25} /> : null}
    </button>
  )
}
