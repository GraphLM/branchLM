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
    <form className="global-composer" onSubmit={handleSubmit}>
      <input
        className="composer-input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <SendButton disabled={disabled || !value.trim()} label="New chat" type="submit" />
    </form>
  )
}
