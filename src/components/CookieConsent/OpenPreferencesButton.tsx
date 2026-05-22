'use client'

import { COOKIE_CONSENT_OPEN_EVENT } from './shared'

type Props = {
  className?: string
}

export const OpenCookiePreferencesButton: React.FC<Props> = ({ className }) => {
  return (
    <button
      className={className}
      onClick={() => {
        window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT))
      }}
      type="button"
    >
      Настройки на бисквитките
    </button>
  )
}
