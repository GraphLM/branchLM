export const buttonBaseClass =
  'inline-flex items-center justify-center gap-1 border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-bg)]/60 disabled:cursor-not-allowed disabled:opacity-55'

export const buttonVariantClass = {
  primary:
    'border-[color:var(--color-control-bg)] bg-[color:var(--color-control-bg)] text-[color:var(--color-control-text)] hover:border-[color:var(--color-control-bg-hover)] hover:bg-[color:var(--color-control-bg-hover)]',
  secondary:
    'border-[color:var(--color-control-bg)] bg-[color:var(--color-control-bg)] text-[color:var(--color-control-text)] hover:border-[color:var(--color-control-bg-hover)] hover:bg-[color:var(--color-control-bg-hover)]',
  danger:
    'border-[color:var(--color-control-bg)] bg-[color:var(--color-control-bg)] text-[color:var(--color-control-text)] hover:border-[color:var(--color-control-bg-hover)] hover:bg-[color:var(--color-control-bg-hover)]',
} as const

export const buttonSizeClass = {
  icon: 'h-9 w-9 rounded-lg shadow-[0_10px_24px_var(--color-chat-shadow)]',
  chip: 'h-8 rounded-full px-3 text-xs tracking-wide shadow-[0_10px_24px_var(--color-chat-shadow)]',
} as const

export function composeButtonClass(params: {
  variant: keyof typeof buttonVariantClass
  size: keyof typeof buttonSizeClass
  className?: string
}): string {
  return [
    buttonBaseClass,
    buttonVariantClass[params.variant],
    buttonSizeClass[params.size],
    params.className ?? '',
  ]
    .join(' ')
    .trim()
}
