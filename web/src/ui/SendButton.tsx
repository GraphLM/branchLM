import type { ButtonHTMLAttributes } from 'react'
import { SendHorizontal } from 'lucide-react'
import { composeButtonClass } from './buttonStyles'

type SendButtonProps = {
  label?: string
  showIcon?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export function SendButton({ label = 'Send', showIcon = true, ...props }: SendButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={composeButtonClass({
        variant: 'primary',
        size: 'icon',
        className: props.className,
      })}
      type="button"
    >
      {showIcon ? <SendHorizontal size={15} strokeWidth={2.25} /> : null}
    </button>
  )
}
