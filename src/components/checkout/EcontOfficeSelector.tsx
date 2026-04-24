'use client'

import { SearchableSelect } from '@/components/ui/searchable-select'
import React, { useEffect, useState } from 'react'

type EcontRegion = {
  id: string
  name: string
}

type EcontCity = {
  id: string
  name: string
  region: string
}

type EcontOffice = {
  address: string
  code: string
  id: string
  isAPS: boolean
  isMPS: boolean
  name: string
}

type Props = {
  disabled?: boolean
  onSelect: (selection: {
    city: EcontCity | null
    office: EcontOffice | null
    region: EcontRegion | null
  }) => void
  selectedCity?: EcontCity | null
  selectedOffice?: EcontOffice | null
  selectedRegion?: EcontRegion | null
}

const FieldLabel: React.FC<{ label: string }> = ({ label }) => (
  <p className="type-eyebrow text-primary/45">{label}</p>
)

export const EcontOfficeSelector: React.FC<Props> = ({
  disabled = false,
  onSelect,
  selectedCity,
  selectedOffice,
  selectedRegion,
}) => {
  const [regions, setRegions] = useState<EcontRegion[]>([])
  const [cities, setCities] = useState<EcontCity[]>([])
  const [offices, setOffices] = useState<EcontOffice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<EcontRegion | null>(selectedRegion || null)
  const [activeCity, setActiveCity] = useState<EcontCity | null>(selectedCity || null)
  const [activeOffice, setActiveOffice] = useState<EcontOffice | null>(selectedOffice || null)
  const regionPlaceholder =
    isLoading && regions.length === 0 ? 'Зареждане на области...' : 'Избери област'
  const cityPlaceholder = !activeRegion
    ? 'Първо избери област'
    : isLoading && cities.length === 0
      ? 'Зареждане на населени места...'
      : 'Избери населено място'
  const officePlaceholder = !activeCity
    ? 'Първо избери населено място'
    : isLoading && offices.length === 0
      ? 'Зареждане на офиси...'
      : 'Избери офис'

  useEffect(() => {
    const controller = new AbortController()

    const loadRegions = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/integrations/econt/offices?level=regions', {
          signal: controller.signal,
        })

        const data = (await response.json()) as {
          message?: string
          regions?: EcontRegion[]
        }

        if (!response.ok) {
          throw new Error(data.message || 'Възникна проблем при зареждането на областите.')
        }

        setRegions(Array.isArray(data.regions) ? data.regions : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error ? error.message : 'Възникна проблем при зареждането на областите.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadRegions()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!activeRegion) {
      setCities([])
      setActiveCity(null)
      setOffices([])
      setActiveOffice(null)
      onSelect({ city: null, office: null, region: null })
      return
    }

    const controller = new AbortController()

    const loadCities = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/integrations/econt/offices?level=cities&region=${encodeURIComponent(activeRegion.id)}`,
          {
            signal: controller.signal,
          },
        )

        const data = (await response.json()) as {
          cities?: EcontCity[]
          message?: string
        }

        if (!response.ok) {
          throw new Error(data.message || 'Възникна проблем при зареждането на населените места.')
        }

        setCities(Array.isArray(data.cities) ? data.cities : [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return

        setError(
          error instanceof Error
            ? error.message
            : 'Възникна проблем при зареждането на населените места.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    setActiveCity(null)
    setOffices([])
    setActiveOffice(null)
    onSelect({ city: null, office: null, region: activeRegion })
    void loadCities()

    return () => controller.abort()
  }, [activeRegion])

  useEffect(() => {
    if (!activeCity) {
      setOffices([])
      setActiveOffice(null)
      onSelect({ city: null, office: null, region: activeRegion })
      return
    }

    const controller = new AbortController()

    const loadOffices = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/integrations/econt/offices?level=offices&cityId=${encodeURIComponent(activeCity.id)}`,
          {
            signal: controller.signal,
          },
        )

        const data = (await response.json()) as {
          message?: string
          offices?: EcontOffice[]
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

    setActiveOffice(null)
    onSelect({ city: activeCity, office: null, region: activeRegion })
    void loadOffices()

    return () => controller.abort()
  }, [activeCity, activeRegion])

  return (
    <div className="rounded-[10px] bg-muted/20 px-5 py-5">
      <div className="mb-4">
        <p className="text-sm text-primary/65">Избери област, населено място и офис на Econt.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FieldLabel label="Област" />
          <SearchableSelect
            disabled={disabled}
            emptyText="Няма намерени области"
            onValueChange={(regionId) => {
              const nextRegion = regions.find((region) => region.id === regionId) || null
              setActiveRegion(nextRegion)
            }}
            options={regions.map((region) => ({
              label: region.name,
              value: region.id,
            }))}
            placeholder={regionPlaceholder}
            searchPlaceholder="Търси област..."
            value={activeRegion?.id}
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel label="Населено място" />
          <SearchableSelect
            disabled={disabled || !activeRegion}
            emptyText={isLoading ? 'Зареждане...' : 'Няма намерени населени места'}
            onValueChange={(cityId) => {
              const nextCity = cities.find((city) => city.id === cityId) || null
              setActiveCity(nextCity)
            }}
            options={cities.map((city) => ({
              keywords: [city.region],
              label: city.name,
              value: city.id,
            }))}
            placeholder={cityPlaceholder}
            searchPlaceholder="Търси населено място..."
            value={activeCity?.id}
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel label="Офис" />
          <SearchableSelect
            disabled={disabled || !activeCity}
            emptyText={isLoading ? 'Зареждане...' : 'Няма намерени офиси'}
            onValueChange={(officeId) => {
              const nextOffice = offices.find((office) => office.id === officeId) || null
              setActiveOffice(nextOffice)

              if (!nextOffice || !activeCity || !activeRegion) return

              onSelect({
                city: activeCity,
                office: nextOffice,
                region: activeRegion,
              })
            }}
            options={offices.map((office) => ({
              description: office.address,
              keywords: [office.address, office.code],
              label: office.name,
              value: office.id,
            }))}
            placeholder={officePlaceholder}
            searchPlaceholder="Търси офис..."
            value={activeOffice?.id}
          />
        </div>

        {isLoading ? <p className="text-sm text-primary/55">Зареждане на наличните опции...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!isLoading && !error && activeCity && offices.length === 0 ? (
          <p className="text-sm text-primary/55">Няма намерени офиси за избраното населено място.</p>
        ) : null}
      </div>

      {activeOffice ? (
        <div className="mt-4 rounded-[10px] border border-[rgb(1,55,186)]/18 bg-white px-4 py-3">
          <p className="type-eyebrow text-primary/45">Избран офис</p>
          <p className="type-subsection-title mt-2 text-primary/85">{activeOffice.name}</p>
          <p className="mt-1 text-sm text-primary/65">
            {activeRegion?.name}
            {activeCity?.name ? `, ${activeCity.name}` : ''}
            {activeOffice.address ? `, ${activeOffice.address}` : ''}
          </p>
          {activeOffice.code ? (
            <p className="mt-2 text-xs text-primary/45">Офис код: {activeOffice.code}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
