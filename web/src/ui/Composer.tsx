import type { FormEvent } from 'react'

import { SendButton } from './SendButton'

type ComposerProps = {
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export function Composer({
  value,
  disabled = false,
  placeholder = 'Start a new chat',
  onChange,
  onSubmit,
}: ComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!disabled) {
      onSubmit()
    }
  }

  return (
    <form
      className="mx-auto mb-3 flex w-[calc(100%-16px)] max-w-4xl gap-2 rounded-2xl border border-[color:var(--color-panel-border)] bg-[color:var(--color-panel)]/90 p-2 shadow-[0_18px_40px_var(--color-chat-shadow)] backdrop-blur md:mb-4 md:w-[min(100%,920px)]"
      onSubmit={handleSubmit}
    >
      <input
        className="nodrag w-full rounded-xl border border-[color:var(--color-input-border)] bg-[color:var(--color-input-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-secondary)] focus:border-[color:var(--color-control-bg)]"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <SendButton disabled={disabled || !value.trim()} label="New chat" type="submit" />
    </form>
  )
}
