'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  COOKIE_CONSENT_OPEN_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  type CookieConsentChoice,
} from './shared'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const updateGoogleConsent = (granted: boolean) => {
  if (typeof window === 'undefined') {
    return
  }

  const consentState = granted ? 'granted' : 'denied'

  window.dataLayer = window.dataLayer || []

  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }
  }

  window.gtag('consent', 'update', {
    ad_personalization: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    analytics_storage: consentState,
  })
}

type Props = {
  analyticsEnabled?: boolean
}

export const CookieConsentBanner: React.FC<Props> = ({ analyticsEnabled = false }) => {
  const [analyticsSelected, setAnalyticsSelected] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!analyticsEnabled) {
      setIsMounted(true)
      setIsVisible(false)
      return
    }

    const storedChoice = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) as CookieConsentChoice | null

    if (storedChoice === 'accepted') {
      setAnalyticsSelected(true)
      setIsVisible(false)
    } else if (storedChoice === 'rejected') {
      setAnalyticsSelected(false)
      setIsVisible(false)
    } else {
      setAnalyticsSelected(true)
      setIsVisible(true)
    }

    const handleOpen = () => {
      const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) as CookieConsentChoice | null
      setAnalyticsSelected(stored !== 'rejected')
      setIsVisible(true)
    }

    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen)
    setIsMounted(true)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen)
    }
  }, [analyticsEnabled])

  const persistChoice = (choice: CookieConsentChoice) => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice)
    updateGoogleConsent(choice === 'accepted')
    setIsVisible(false)
  }

  if (!isMounted || !analyticsEnabled || !isVisible) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/96 shadow-[0_-12px_32px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="container py-4 md:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="type-subsection-title text-primary/90">Настройки за бисквитките</p>
            <p className="mt-2 text-sm leading-6 text-primary/68">
              Използваме необходими бисквитки за работата на сайта и по избор аналитични
              бисквитки, за да разбираме как се използва сайтът. Повече информация има в{' '}
              <Link className="text-[rgb(1,55,186)] underline-offset-4 hover:underline" href="/privacy">
                Политиката за поверителност
              </Link>
              .
            </p>
          </div>

          <div className="w-full max-w-xl rounded-[10px] border border-black/8 bg-white p-4">
            <label className="flex items-start gap-3">
              <input
                checked={analyticsSelected}
                className="mt-1 h-4 w-4 rounded border-black/20 accent-[rgb(1,55,186)]"
                onChange={(event) => {
                  setAnalyticsSelected(event.target.checked)
                }}
                type="checkbox"
              />
              <span className="block">
                <span className="block text-sm font-medium text-primary/86">Аналитични</span>
                <span className="mt-1 block text-sm leading-6 text-primary/60">
                  Помагат ни да измерваме посещенията и поведението в сайта чрез Google
                  Analytics.
                </span>
              </span>
            </label>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                className="bg-[rgb(1,55,186)] text-white hover:bg-[rgb(1,55,186)]"
                onClick={() => {
                  setAnalyticsSelected(true)
                  persistChoice('accepted')
                }}
                type="button"
              >
                Приемам
              </Button>
              <Button
                className="border-black/12 bg-white text-primary/80 hover:bg-black/[0.02]"
                onClick={() => {
                  setAnalyticsSelected(false)
                  persistChoice('rejected')
                }}
                type="button"
                variant="outline"
              >
                Отказвам
              </Button>
              <Button
                className={cn(
                  'border-black/12 bg-white text-primary/80 hover:bg-black/[0.02]',
                )}
                onClick={() => {
                  persistChoice(analyticsSelected ? 'accepted' : 'rejected')
                }}
                type="button"
                variant="outline"
              >
                Запази настройките
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
