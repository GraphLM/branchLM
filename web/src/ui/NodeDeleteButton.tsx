import type { ButtonHTMLAttributes } from 'react'
import { Trash2 } from 'lucide-react'
import { composeButtonClass } from './buttonStyles'

type NodeDeleteButtonProps = {
  label?: string
  showIcon?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export function NodeDeleteButton({ label = 'Delete', showIcon = true, ...props }: NodeDeleteButtonProps) {
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
      {showIcon ? <Trash2 size={13} strokeWidth={2.1} /> : null}
    </button>
  )
}
