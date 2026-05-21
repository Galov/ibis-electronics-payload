'use client'

import { Button } from '@/components/ui/button'
import React, { useEffect, useId, useMemo, useState } from 'react'

type BoxNowLocker = {
  address: string
  id: string
  latitude: string
  longitude: string
  name: string
  postalCode: string
}

type BoxNowWidgetSelection = {
  addressLine1?: string
  addressLine2?: string
  boxnowLockerAddressLine1?: string
  boxnowLockerAddressLine2?: string
  boxnowLockerId?: number | string
  boxnowLockerLat?: number | string
  boxnowLockerLng?: number | string
  boxnowLockerName?: string
  boxnowLockerPostalCode?: number | string
  lat?: number | string
  lng?: number | string
  name?: string
  postalCode?: number | string
  title?: string
}

declare global {
  interface Window {
    _bn_map_widget_config?: Record<string, unknown>
  }
}

type Props = {
  disabled?: boolean
  onSelect: (locker: BoxNowLocker | null) => void
  selectedLocker?: BoxNowLocker | null
}

const WIDGET_SCRIPT_ID = 'boxnow-map-widget-script'
const WIDGET_SCRIPT_URL = 'https://widget-cdn.boxnow.bg/map-widget/client/v5.js'

const toText = (value: unknown) => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

const normalizeSelectedLocker = (selection: BoxNowWidgetSelection): BoxNowLocker | null => {
  const id = toText(selection.boxnowLockerId)
  const name = toText(selection.boxnowLockerName || selection.name || selection.title)
  const postalCode = toText(selection.boxnowLockerPostalCode || selection.postalCode)
  const address = [
    toText(selection.boxnowLockerAddressLine1 || selection.addressLine1),
    toText(selection.boxnowLockerAddressLine2 || selection.addressLine2),
  ]
    .filter(Boolean)
    .join(', ')
  const latitude = toText(selection.boxnowLockerLat || selection.lat)
  const longitude = toText(selection.boxnowLockerLng || selection.lng)

  if (!id) return null

  return {
    address,
    id,
    latitude,
    longitude,
    name: name || `BoxNow автомат ${id}`,
    postalCode,
  }
}

export const BoxNowOfficeSelector: React.FC<Props> = ({
  disabled = false,
  onSelect,
  selectedLocker,
}) => {
  const [activeLocker, setActiveLocker] = useState<BoxNowLocker | null>(selectedLocker || null)
  const [error, setError] = useState<string | null>(null)
  const [isWidgetReady, setIsWidgetReady] = useState(false)
  const containerID = useId().replace(/:/g, '')
  const buttonClassName = useMemo(() => `boxnow-map-widget-button-${containerID}`, [containerID])
  const partnerId = process.env.NEXT_PUBLIC_BOXNOW_PARTNER_ID?.trim() || ''

  useEffect(() => {
    onSelect(activeLocker)
  }, [activeLocker, onSelect])

  useEffect(() => {
    let cancelled = false

    window._bn_map_widget_config = {
      ...(partnerId ? { partnerId } : {}),
      afterSelect: (selected: BoxNowWidgetSelection) => {
        const locker = normalizeSelectedLocker(selected)

        if (!locker) {
          setError('BoxNow widget не върна валиден автомат. Опитай отново.')
          return
        }

        setError(null)
        setActiveLocker(locker)
      },
      autoclose: true,
      buttonSelector: `.${buttonClassName}`,
      gps: true,
      parentElement: `#${containerID}`,
      type: 'popup',
    }

    const existingScript = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null

    if (existingScript) {
      setIsWidgetReady(true)
      return
    }

    const script = document.createElement('script')
    script.id = WIDGET_SCRIPT_ID
    script.src = WIDGET_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!cancelled) {
        setIsWidgetReady(true)
      }
    }
    script.onerror = () => {
      if (!cancelled) {
        setError('BoxNow картата не можа да се зареди. Опитай да презаредиш страницата.')
      }
    }

    document.head.appendChild(script)

    return () => {
      cancelled = true
    }
  }, [buttonClassName, containerID, partnerId])

  return (
    <div className="rounded-[10px] bg-muted/20 px-5 py-5">
      <div className="mb-4">
        <p className="text-sm text-primary/65">
          Избери удобен автомат на BoxNow от карта. Доставката е безплатна до 31 юли 2026 г.
        </p>
        <p className="mt-2 text-sm text-primary/65">
          Ако поръчката не е платена онлайн, при получаване плащането е възможно само с карта.
        </p>
      </div>

      <div id={containerID} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          className={buttonClassName}
          disabled={disabled || !isWidgetReady}
          type="button"
          variant="outline"
        >
          {activeLocker ? 'Смени автомат на карта' : 'Избери автомат на карта'}
        </Button>

        {activeLocker ? (
          <button
            className="text-sm text-primary/55 underline-offset-4 hover:text-primary/75 hover:underline"
            disabled={disabled}
            onClick={() => setActiveLocker(null)}
            type="button"
          >
            Изчисти избора
          </button>
        ) : null}
      </div>

      {!isWidgetReady && !error ? (
        <p className="mt-3 text-sm text-primary/55">Зареждане на BoxNow карта...</p>
      ) : null}

      {activeLocker ? (
        <div className="mt-4 rounded-[10px] border border-black/6 bg-white px-4 py-4">
          <p className="type-subsection-title text-primary/85">{activeLocker.name}</p>
          {activeLocker.address ? (
            <p className="mt-2 text-sm text-primary/60">{activeLocker.address}</p>
          ) : null}
          {activeLocker.postalCode ? (
            <p className="mt-2 text-xs text-primary/45">ПК: {activeLocker.postalCode}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
