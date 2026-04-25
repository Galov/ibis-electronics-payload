'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { createUrl } from '@/utilities/createUrl'
import { SearchIcon, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

type BrandOption = {
  id: string
  slug: string
  title: string
}

type ActiveFilter = {
  key: string
  label: string
}

const tokenizeSearchTerms = (value: string) =>
  value
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

type Props = {
  availableBrands?: BrandOption[]
  className?: string
  showBrandFilter?: boolean
}

export const Search: React.FC<Props> = ({
  availableBrands = [],
  className,
  showBrandFilter = false,
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchQuery = searchParams?.get('q') || ''
  const [selectedBrandTitle, setSelectedBrandTitle] = useState('')
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState<string | null>(null)
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false)
  const [searchInputValue, setSearchInputValue] = useState(searchQuery)
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('')
  const [isPlaceholderVisible, setIsPlaceholderVisible] = useState(true)
  const [refinementMaxHeight, setRefinementMaxHeight] = useState('0px')
  const [shouldRenderRefinement, setShouldRenderRefinement] = useState(false)
  const [isRefinementVisible, setIsRefinementVisible] = useState(false)
  const [renderedShowBrandFilter, setRenderedShowBrandFilter] = useState(false)
  const [renderedActiveFilters, setRenderedActiveFilters] = useState<ActiveFilter[]>([])
  const selectedCategoryID = searchParams?.get('category')
  const selectedBrandSlug = searchParams?.get('brand')
  const brandFilterRef = useRef<HTMLDivElement | null>(null)
  const refinementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let isMounted = true

    if (selectedBrandSlug) {
      const selectedBrand = availableBrands.find((brand) => brand.slug === selectedBrandSlug)
      setSelectedBrandTitle(selectedBrand?.title || '')
    } else {
      setSelectedBrandTitle('')
    }

    if (!selectedCategoryID) {
      setSelectedCategoryTitle(null)
    } else {
      const loadCategoryTitle = async () => {
        try {
          const response = await fetch(`/api/categories/${selectedCategoryID}`)

          if (!response.ok) {
            throw new Error('Failed to load category title.')
          }

          const category = await response.json()

          if (isMounted) {
            setSelectedCategoryTitle(category?.title || null)
          }
        } catch {
          if (isMounted) {
            setSelectedCategoryTitle(null)
          }
        }
      }

      void loadCategoryTitle()
    }

    return () => {
      isMounted = false
    }
  }, [availableBrands, selectedBrandSlug, selectedCategoryID])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!brandFilterRef.current?.contains(event.target as Node)) {
        setIsBrandDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const placeholder = useMemo(() => {
    if (selectedCategoryTitle) {
      return `Търси по име, марка, категория, производител, номер в ${selectedCategoryTitle}`
    }

    return 'Търси по име, марка, категория, производител, номер във всички продукти'
  }, [selectedCategoryTitle])

  useEffect(() => {
    setSearchInputValue(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (searchInputValue.trim()) {
      setAnimatedPlaceholder(placeholder)
      setIsPlaceholderVisible(false)
      return
    }

    if (!animatedPlaceholder) {
      setAnimatedPlaceholder(placeholder)
      setIsPlaceholderVisible(true)
      return
    }

    if (animatedPlaceholder === placeholder) {
      setIsPlaceholderVisible(true)
      return
    }

    setIsPlaceholderVisible(false)

    const timeout = window.setTimeout(() => {
      setAnimatedPlaceholder(placeholder)
      setIsPlaceholderVisible(true)
    }, 500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [animatedPlaceholder, placeholder, searchInputValue])
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchParams?.get('q') ||
        searchParams?.get('brand') ||
        searchParams?.get('category') ||
        searchParams?.get('sort'),
    )
  }, [searchParams])

  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = []
    const searchTerms = tokenizeSearchTerms(searchParams?.get('q')?.trim() || '')

    filters.push(
      ...searchTerms.map((term, index) => ({
        key: `q:${index}`,
        label: term,
      })),
    )

    if (selectedBrandTitle.trim()) {
      filters.push({ key: 'brand', label: `Марка: ${selectedBrandTitle}` })
    }

    if (selectedCategoryTitle?.trim()) {
      filters.push({ key: 'category', label: `Категория: ${selectedCategoryTitle}` })
    }

    return filters
  }, [searchParams, selectedBrandTitle, selectedCategoryTitle])

  const filteredBrands = useMemo(() => {
    const query = selectedBrandTitle.trim().toLowerCase()

    if (!query) return availableBrands

    return availableBrands.filter((brand) => brand.title.toLowerCase().includes(query))
  }, [availableBrands, selectedBrandTitle])

  const showRefinementSection = showBrandFilter || activeFilters.length > 0

  useEffect(() => {
    if (showRefinementSection) {
      setShouldRenderRefinement(true)
      setRenderedShowBrandFilter(showBrandFilter)
      setRenderedActiveFilters(activeFilters)
      setIsRefinementVisible(true)
      return
    }

    const visibilityTimeout = window.setTimeout(() => {
      setIsRefinementVisible(false)
    }, 320)

    const timeout = window.setTimeout(() => {
      setShouldRenderRefinement(false)
      setRenderedShowBrandFilter(false)
      setRenderedActiveFilters([])
    }, 900)

    return () => {
      window.clearTimeout(visibilityTimeout)
      window.clearTimeout(timeout)
    }
  }, [activeFilters, showBrandFilter, showRefinementSection])

  useEffect(() => {
    if (!refinementRef.current) return

    const updateOpenHeight = () => {
      if (!refinementRef.current) return
      setRefinementMaxHeight(`${refinementRef.current.scrollHeight}px`)
    }

    if (showRefinementSection) {
      updateOpenHeight()

      const observer = new ResizeObserver(() => {
        updateOpenHeight()
      })

      observer.observe(refinementRef.current)

      return () => {
        observer.disconnect()
      }
    }

    const heightTimeout = window.setTimeout(() => {
      const currentHeight = `${refinementRef.current?.scrollHeight || 0}px`
      setRefinementMaxHeight(currentHeight)

      const frame = window.requestAnimationFrame(() => {
        setRefinementMaxHeight('0px')
      })

      return () => {
        window.cancelAnimationFrame(frame)
      }
    }, 340)

    return () => {
      window.clearTimeout(heightTimeout)
    }
  }, [activeFilters.length, shouldRenderRefinement, showBrandFilter, showRefinementSection])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const val = e.target as HTMLFormElement
    const search = val.searchQuery as HTMLInputElement
    const newParams = new URLSearchParams(searchParams.toString())

    if (search.value) {
      newParams.set('q', search.value)
    } else {
      newParams.delete('q')
      newParams.delete('name')
      newParams.delete('sku')
    }

    newParams.delete('page')

    router.push(createUrl('/shop', newParams))
  }

  function onResetFilters() {
    router.push('/shop')
  }

  function onRemoveFilter(filterKey: ActiveFilter['key']) {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (filterKey.startsWith('q:')) {
      const tokenIndex = Number(filterKey.split(':')[1])
      const currentSearchTerms = tokenizeSearchTerms(searchParams.get('q') || '')
      const nextSearchTerms = currentSearchTerms.filter((_, index) => index !== tokenIndex)

      if (nextSearchTerms.length > 0) {
        nextParams.set('q', nextSearchTerms.join(' '))
      } else {
        nextParams.delete('q')
        nextParams.delete('name')
        nextParams.delete('sku')
      }
    } else {
      nextParams.delete(filterKey)
    }

    if (filterKey === 'brand') {
      setSelectedBrandTitle('')
      setIsBrandDropdownOpen(false)
    }

    nextParams.delete('page')

    router.push(createUrl('/shop', nextParams))
  }

  function onBrandFilterChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextTitle = event.target.value
    setSelectedBrandTitle(nextTitle)
    setIsBrandDropdownOpen(true)

    if (!nextTitle.trim() && searchParams.get('brand')) {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.delete('brand')
      nextParams.delete('page')
      router.push(createUrl('/shop', nextParams))
    }
  }

  function onSelectBrand(brand: BrandOption) {
    setSelectedBrandTitle(brand.title)
    setIsBrandDropdownOpen(false)

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('brand', brand.slug)
    nextParams.delete('page')

    router.push(createUrl('/shop', nextParams))
  }

  function onClearBrandFilter() {
    setSelectedBrandTitle('')
    setIsBrandDropdownOpen(false)

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('brand')
    nextParams.delete('page')

    router.push(createUrl('/shop', nextParams))
  }

  return (
    <div
      className={cn(
        'px-0 py-0',
        className,
      )}
    >
      <form
        className={cn(
          'grid w-full items-stretch gap-3 transition-[grid-template-columns] ease-in-out md:[grid-template-columns:minmax(0,1fr)_10.5rem_var(--reset-width)]',
        )}
        style={
          {
            '--reset-width': hasActiveFilters ? '13.5rem' : '0rem',
            transitionDuration: hasActiveFilters ? '500ms' : '1240ms',
          } as CSSProperties
        }
        onSubmit={onSubmit}
      >
        <div className="relative">
          <input
            autoComplete="off"
            className="h-12 w-full rounded-md border bg-white px-5 pr-12 text-[16px] text-black placeholder:text-neutral-500 md:text-sm dark:border-neutral-800 dark:bg-black dark:text-white dark:placeholder:text-neutral-400"
            defaultValue={searchQuery}
            key={searchQuery}
            name="searchQuery"
            onChange={(event) => setSearchInputValue(event.target.value)}
            placeholder=""
            type="text"
          />
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 left-5 right-12 flex items-center text-[16px] text-neutral-500 transition-opacity duration-1000 ease-in-out md:text-sm dark:text-neutral-400',
              isPlaceholderVisible && !searchInputValue.trim() ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="truncate">{animatedPlaceholder}</span>
          </div>
          <div className="absolute right-0 top-0 mr-3 flex h-full items-center">
            <SearchIcon className="h-4" />
          </div>
        </div>
        <Button
          className="h-12 w-full rounded-md bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)]"
          type="submit"
        >
          Търси
        </Button>
        <div
          className={cn(
            'overflow-hidden transition-[opacity,transform] ease-in-out md:block',
            hasActiveFilters
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none hidden translate-x-3 opacity-0 md:block',
          )}
          style={{
            transitionDuration: hasActiveFilters ? '500ms' : '1240ms',
          }}
        >
          <Button
            className="h-12 w-full rounded-md px-5 text-sm font-normal md:w-[13.5rem]"
            onClick={onResetFilters}
            type="button"
            variant="outline"
          >
            Изчисти филтрите
          </Button>
        </div>
      </form>

      <div
        className={cn('relative z-20 overflow-hidden transition-[max-height,margin-top] ease-in-out', {
          'mt-4': showRefinementSection || shouldRenderRefinement,
          'mt-0': !showRefinementSection && !shouldRenderRefinement,
        })}
        style={{
          maxHeight: refinementMaxHeight,
          transitionDuration: showRefinementSection ? '500ms' : '900ms',
        }}
      >
        <div
          className={cn('flex flex-col gap-3 transition-opacity duration-400 ease-in-out', {
            'opacity-100': isRefinementVisible,
            'opacity-0': !isRefinementVisible,
          })}
          ref={refinementRef}
        >
          {shouldRenderRefinement && renderedShowBrandFilter ? (
            <div
              className={cn(
                'relative z-30 grid w-full gap-3 md:[grid-template-columns:minmax(0,1fr)_10.5rem_var(--reset-width)]',
              )}
              style={
                {
                  '--reset-width': hasActiveFilters ? '13.5rem' : '0rem',
                } as CSSProperties
              }
              ref={brandFilterRef}
            >
              <div className="relative md:col-start-1">
                <input
                  autoComplete="off"
                  className="h-11 w-full rounded-md border bg-white px-4 pr-11 text-[16px] text-black placeholder:text-neutral-500 md:text-sm dark:border-neutral-800 dark:bg-black dark:text-white dark:placeholder:text-neutral-400"
                  name="brandQuery"
                  onChange={onBrandFilterChange}
                  onFocus={() => setIsBrandDropdownOpen(true)}
                  placeholder="Филтрирай по марка..."
                  type="text"
                  value={selectedBrandTitle}
                />

                {selectedBrandTitle ? (
                  <button
                    aria-label="Изчисти филтъра по марка"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 transition hover:text-primary/75"
                    onClick={onClearBrandFilter}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}

                {isBrandDropdownOpen && filteredBrands.length > 0 ? (
                  <div className="mt-1.5 w-full border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                    <div className="max-h-80 overflow-auto py-1">
                      {filteredBrands.map((brand) => (
                        <button
                          className="block w-full px-4 py-2.5 text-left text-sm text-primary/75 transition hover:bg-[rgb(1,55,186)]/6 hover:text-primary"
                          key={brand.slug}
                          onClick={() => onSelectBrand(brand)}
                          type="button"
                        >
                          {brand.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {shouldRenderRefinement && renderedActiveFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {renderedActiveFilters.map((filter) => (
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-primary/65 transition hover:text-primary/85"
                  key={filter.key}
                  onClick={() => onRemoveFilter(filter.key)}
                  type="button"
                >
                  <span>{filter.label}</span>
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
