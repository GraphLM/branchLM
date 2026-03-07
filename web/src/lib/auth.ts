function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function getDevBypassEmail(): string {
  return (import.meta.env.VITE_DEV_BYPASS_EMAIL || 'test@example.com').trim().toLowerCase()
}

function buildDevBypassToken(): string {
  return `dev-bypass:${toBase64Url(getDevBypassEmail())}`
}

export function getAccessToken(): string | null {
  if (isTruthy(import.meta.env.VITE_AUTH_DEV_BYPASS)) {
    return buildDevBypassToken()
  }

  return null
}
