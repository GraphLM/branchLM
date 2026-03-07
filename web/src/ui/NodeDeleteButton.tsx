import type { ButtonHTMLAttributes } from 'react'

type NodeDeleteButtonProps = {
  label?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function NodeDeleteButton({ label = 'Delete', ...props }: NodeDeleteButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`node-delete-button ${props.className ?? ''}`.trim()}
      type="button"
    >
      {label}
    </button>
  )
}
