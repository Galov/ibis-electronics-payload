'use client'

import { useCommerceTranslation, CommerceText } from '@/i18n/CommerceText'

import { SearchableSelect } from '@/components/ui/searchable-select'
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
    office: SpeedyOffice | null
    site: SpeedySite | null
    state: SpeedyState | null
  }) => void
  selectedOffice?: SpeedyOffice | null
  selectedSite?: SpeedySite | null
  selectedState?: SpeedyState | null
}

const FieldLabel: React.FC<{
  label: string
}> = ({ label }) => <p className="type-eyebrow text-primary/45">{label}</p>

export const SpeedyOfficeSelector: React.FC<Props> = ({
  disabled = false,
  onSelect,
  selectedOffice,
  selectedSite,
  selectedState,
}) => {
  const ui = useCommerceTranslation()

  const [states, setStates] = useState<SpeedyState[]>([])
  const [sites, setSites] = useState<SpeedySite[]>([])
  const [offices, setOffices] = useState<SpeedyOffice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeState, setActiveState] = useState<SpeedyState | null>(selectedState || null)
  const [activeSite, setActiveSite] = useState<SpeedySite | null>(selectedSite || null)
  const [activeOffice, setActiveOffice] = useState<SpeedyOffice | null>(selectedOffice || null)
  const statePlaceholder =
    isLoading && states.length === 0 ? ui('Зареждане на области...') : ui('Избери област')
  const sitePlaceholder = !activeState
    ? ui('Първо избери област')
    : isLoading && sites.length === 0
      ? ui('Зареждане на населени места...')
      : ui('Избери населено място')
  const officePlaceholder = !activeSite
    ? ui('Първо избери населено място')
    : isLoading && offices.length === 0
      ? ui('Зареждане на офиси...')
      : ui('Избери офис')

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
          throw new Error(data.message || ui('Възникна проблем при зареждането на областите.'))
        }

        setStates(Array.isArray(data.states) ? data.states : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error
            ? error.message
            : ui('Възникна проблем при зареждането на областите.'),
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadStates()

    return () => {
      controller.abort()
    }
  }, [ui])

  useEffect(() => {
    if (!activeState) {
      setSites([])
      setActiveSite(null)
      setOffices([])
      setActiveOffice(null)
      onSelect({ office: null, site: null, state: null })
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
          throw new Error(data.message || ui('Възникна проблем при зареждането на градовете.'))
        }

        setSites(Array.isArray(data.sites) ? data.sites : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error
            ? error.message
            : ui('Възникна проблем при зареждането на градовете.'),
        )
      } finally {
        setIsLoading(false)
      }
    }

    setActiveSite(null)
    setOffices([])
    setActiveOffice(null)
    onSelect({ office: null, site: null, state: activeState })
    void loadSites()

    return () => {
      controller.abort()
    }
  }, [activeState, ui])

  useEffect(() => {
    if (!activeSite) {
      setOffices([])
      setActiveOffice(null)
      onSelect({ office: null, site: null, state: activeState })
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
          throw new Error(data.message || ui('Възникна проблем при зареждането на офисите.'))
        }

        setOffices(Array.isArray(data.offices) ? data.offices : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error
            ? error.message
            : ui('Възникна проблем при зареждането на офисите.'),
        )
      } finally {
        setIsLoading(false)
      }
    }

    setActiveOffice(null)
    onSelect({ office: null, site: activeSite, state: activeState })
    void loadOffices()

    return () => {
      controller.abort()
    }
  }, [activeSite, ui])

  return (
    <div className="rounded-[10px] bg-muted/20 px-5 py-5">
      <div className="mb-4">
        <p className="text-sm text-primary/65">
          <CommerceText source={'Избери област, населено място и офис на Speedy.'} />
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FieldLabel label={ui('Област')} />
          <SearchableSelect
            disabled={disabled || isLoading || states.length === 0}
            emptyText={ui('Няма намерени области')}
            onValueChange={(stateId) => {
              const nextState = states.find((state) => state.id === stateId) || null
              setActiveState(nextState)
            }}
            options={states.map((state) => ({
              label: state.name,
              value: state.id,
            }))}
            placeholder={statePlaceholder}
            searchPlaceholder={ui('Търси област...')}
            value={activeState?.id}
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel label={ui('Населено място')} />
          <SearchableSelect
            disabled={disabled || isLoading || !activeState || sites.length === 0}
            emptyText={isLoading ? ui('Зареждане...') : ui('Няма намерени населени места')}
            onValueChange={(siteId) => {
              const nextSite = sites.find((site) => site.id === siteId) || null
              setActiveSite(nextSite)
            }}
            options={sites.map((site) => ({
              keywords: [site.region],
              label: site.name,
              value: site.id,
            }))}
            placeholder={sitePlaceholder}
            searchPlaceholder={ui('Търси населено място...')}
            value={activeSite?.id}
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel label={ui('Офис')} />
          <SearchableSelect
            disabled={disabled || isLoading || !activeSite || offices.length === 0}
            emptyText={isLoading ? ui('Зареждане...') : ui('Няма намерени офиси')}
            onValueChange={(officeId) => {
              const nextOffice = offices.find((office) => office.id === officeId) || null
              setActiveOffice(nextOffice)

              if (!nextOffice || !activeState || !activeSite) return

              onSelect({
                office: nextOffice,
                site: activeSite,
                state: activeState,
              })
            }}
            options={offices.map((office) => ({
              description: office.address,
              keywords: [office.address, office.siteId],
              label: office.name,
              value: office.id,
            }))}
            placeholder={officePlaceholder}
            searchPlaceholder={ui('Търси офис...')}
            value={activeOffice?.id}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-primary/55">
            <CommerceText source={'Зареждане на наличните опции...'} />
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">
            <CommerceText source={error} error />
          </p>
        ) : null}
        {!isLoading && !error && activeSite && offices.length === 0 ? (
          <p className="text-sm text-primary/55">
            <CommerceText source={'Няма намерени офиси за избрания град.'} />
          </p>
        ) : null}
      </div>

      {activeOffice ? (
        <div className="mt-4 rounded-[10px] border border-[rgb(1,55,186)]/18 bg-white px-4 py-3">
          <p className="type-eyebrow text-primary/45">
            <CommerceText source={'Избран офис'} />
          </p>
          <p className="type-subsection-title mt-2 text-primary/85">{activeOffice.name}</p>
          <p className="mt-1 text-sm text-primary/65">
            {activeState?.name}
            {activeSite?.name ? `, ${activeSite.name}` : ''}
            {activeOffice.address ? `, ${activeOffice.address}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  )
}
