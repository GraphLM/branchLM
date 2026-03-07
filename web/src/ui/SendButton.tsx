import type { ButtonHTMLAttributes } from 'react'

type SendButtonProps = {
  label?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function SendButton({ label = 'Send', ...props }: SendButtonProps) {
  return (
    <button {...props} className={`send-button ${props.className ?? ''}`.trim()} type="button">
      {label}
    </button>
  )
}
