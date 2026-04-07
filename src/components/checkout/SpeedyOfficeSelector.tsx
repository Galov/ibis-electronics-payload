'use client'

import { cn } from '@/utilities/cn'
import React, { useEffect, useState } from 'react'

type SpeedyState = {
  id: string
  name: string
}

type SpeedySite = {
  id: string
  name: string
  region: string
}

type SpeedyOffice = {
  address: string
  id: string
  name: string
  siteId: string
}

type Props = {
  disabled?: boolean
  onSelect: (selection: {
    office: SpeedyOffice
    site: SpeedySite
    state: SpeedyState
  }) => void
  selectedOffice?: SpeedyOffice | null
  selectedSite?: SpeedySite | null
  selectedState?: SpeedyState | null
}

const SelectLabel: React.FC<{
  disabled?: boolean
  label: string
  value?: string | null
}> = ({ disabled = false, label, value }) => (
  <div className="space-y-2">
    <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary/45">{label}</p>
    <div
      className={cn(
        'flex min-h-11 items-center rounded-md border bg-white px-4 py-2 text-sm',
        disabled ? 'cursor-not-allowed opacity-60' : 'border-black/8',
      )}
    >
      <span className={value ? 'text-primary/80' : 'text-primary/45'}>
        {value || `Избери ${label.toLowerCase()}`}
      </span>
    </div>
  </div>
)

export const SpeedyOfficeSelector: React.FC<Props> = ({
  disabled = false,
  onSelect,
  selectedOffice,
  selectedSite,
  selectedState,
}) => {
  const [states, setStates] = useState<SpeedyState[]>([])
  const [sites, setSites] = useState<SpeedySite[]>([])
  const [offices, setOffices] = useState<SpeedyOffice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeState, setActiveState] = useState<SpeedyState | null>(selectedState || null)
  const [activeSite, setActiveSite] = useState<SpeedySite | null>(selectedSite || null)

  useEffect(() => {
    const controller = new AbortController()

    const loadStates = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/integrations/speedy/offices?level=states`, {
          signal: controller.signal,
        })

        const data = (await response.json()) as {
          message?: string
          states?: SpeedyState[]
        }

        if (!response.ok) {
          throw new Error(data.message || 'Възникна проблем при зареждането на областите.')
        }

        setStates(Array.isArray(data.states) ? data.states : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error
            ? error.message
            : 'Възникна проблем при зареждането на областите.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadStates()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!activeState) {
      setSites([])
      setActiveSite(null)
      setOffices([])
      return
    }

    const controller = new AbortController()

    const loadSites = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/integrations/speedy/offices?level=sites&state=${encodeURIComponent(activeState.id)}`,
          {
            signal: controller.signal,
          },
        )

        const data = (await response.json()) as {
          message?: string
          sites?: SpeedySite[]
        }

        if (!response.ok) {
          throw new Error(data.message || 'Възникна проблем при зареждането на градовете.')
        }

        setSites(Array.isArray(data.sites) ? data.sites : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error ? error.message : 'Възникна проблем при зареждането на градовете.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    setActiveSite(null)
    setOffices([])
    void loadSites()

    return () => {
      controller.abort()
    }
  }, [activeState])

  useEffect(() => {
    if (!activeSite) {
      setOffices([])
      return
    }

    const controller = new AbortController()

    const loadOffices = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/integrations/speedy/offices?level=offices&siteId=${encodeURIComponent(activeSite.id)}`,
          {
            signal: controller.signal,
          },
        )

        const data = (await response.json()) as {
          message?: string
          offices?: SpeedyOffice[]
        }

        if (!response.ok) {
          throw new Error(data.message || 'Възникна проблем при зареждането на офисите.')
        }

        setOffices(Array.isArray(data.offices) ? data.offices : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error ? error.message : 'Възникна проблем при зареждането на офисите.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadOffices()

    return () => {
      controller.abort()
    }
  }, [activeSite])

  return (
    <div className="rounded-[10px] bg-muted/20 px-5 py-5">
      <div className="mb-4">
        <p className="text-sm text-primary/65">Избери област, град и офис на Speedy.</p>
      </div>

      <div className="space-y-4">
        <SelectLabel disabled={disabled} label="Област" value={activeState?.name} />
        {states.length > 0 ? (
          <div className="max-h-56 space-y-2 overflow-auto">
            {states.map((state) => (
              <button
                className={cn(
                  'block w-full rounded-[10px] border bg-white px-4 py-3 text-left text-sm transition',
                  activeState?.id === state.id
                    ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                    : 'border-black/8 hover:border-black/15',
                )}
                disabled={disabled}
                key={state.id}
                onClick={() => setActiveState(state)}
                type="button"
              >
                {state.name}
              </button>
            ))}
          </div>
        ) : null}

        <SelectLabel disabled={disabled || !activeState} label="Град" value={activeSite?.name} />
        {activeState && sites.length > 0 ? (
          <div className="max-h-56 space-y-2 overflow-auto">
            {sites.map((site) => (
              <button
                className={cn(
                  'block w-full rounded-[10px] border bg-white px-4 py-3 text-left text-sm transition',
                  activeSite?.id === site.id
                    ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                    : 'border-black/8 hover:border-black/15',
                )}
                disabled={disabled}
                key={site.id}
                onClick={() => setActiveSite(site)}
                type="button"
              >
                {site.name}
              </button>
            ))}
          </div>
        ) : null}

        <SelectLabel disabled={disabled || !activeSite} label="Офис" value={selectedOffice?.name} />
        {isLoading ? <p className="text-sm text-primary/55">Зареждане...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!isLoading && !error && activeSite && offices.length === 0 ? (
          <p className="text-sm text-primary/55">Няма намерени офиси за избрания град.</p>
        ) : null}

        {offices.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-auto">
            {offices.map((office) => {
              const isSelected = selectedOffice?.id === office.id

              return (
                <button
                  className={cn(
                    'block w-full rounded-[10px] border bg-white px-4 py-3 text-left transition',
                    isSelected
                      ? 'border-[rgb(1,55,186)] bg-[rgb(1,55,186)]/5'
                      : 'border-black/8 hover:border-black/15',
                  )}
                  disabled={disabled}
                  key={office.id}
                  onClick={() => {
                    if (!activeState || !activeSite) return

                    onSelect({
                      office,
                      site: activeSite,
                      state: activeState,
                    })
                  }}
                  type="button"
                >
                  <p className="text-sm font-medium text-primary/85">{office.name}</p>
                  <p className="mt-1 text-sm text-primary/65">{office.address}</p>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {selectedOffice ? (
        <div className="mt-4 rounded-[10px] border border-[rgb(1,55,186)]/18 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary/45">
            Избран офис
          </p>
          <p className="mt-2 text-sm font-medium text-primary/85">{selectedOffice.name}</p>
          <p className="mt-1 text-sm text-primary/65">
            {selectedState?.name}
            {selectedSite?.name ? `, ${selectedSite.name}` : ''}
            {selectedOffice.address ? `, ${selectedOffice.address}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  )
}
