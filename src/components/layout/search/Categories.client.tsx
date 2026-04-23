'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'

type CategoryNode = {
  id: string
  productCount?: number | null
  title: string
  children: CategoryNode[]
}

type ItemProps = {
  category: CategoryNode
  expandedCategoryIDs: Set<string>
  level?: number
  onToggleCategory: (id: string) => void
}

type TreeProps = {
  categories: CategoryNode[]
}

type PanelProps = {
  categories: CategoryNode[]
}

const CategoryChildren: React.FC<{
  childrenNodes: CategoryNode[]
  expandedCategoryIDs: Set<string>
  isExpanded: boolean
  level: number
  onToggleCategory: (id: string) => void
}> = ({ childrenNodes, expandedCategoryIDs, isExpanded, level, onToggleCategory }) => {
  const contentRef = useRef<HTMLUListElement | null>(null)
  const [maxHeight, setMaxHeight] = useState('0px')

  useEffect(() => {
    if (!contentRef.current) return

    setMaxHeight(isExpanded ? `${contentRef.current.scrollHeight}px` : '0px')
  }, [childrenNodes, expandedCategoryIDs, isExpanded])

  return (
    <div
      className={clsx(
        'overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out',
        isExpanded ? 'opacity-100' : 'opacity-0',
      )}
      style={{ maxHeight }}
    >
      <ul className="mt-1" ref={contentRef}>
        {childrenNodes.map((child) => {
          return (
            <CategoryItem
              key={child.id}
              category={child}
              expandedCategoryIDs={expandedCategoryIDs}
              level={level}
              onToggleCategory={onToggleCategory}
            />
          )
        })}
      </ul>
    </div>
  )
}

export const CategoryItem: React.FC<ItemProps> = ({
  category,
  expandedCategoryIDs,
  level = 0,
  onToggleCategory,
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isExpanded = expandedCategoryIDs.has(category.id)

  const isActive = useMemo(() => {
    return searchParams.get('category') === String(category.id)
  }, [category.id, searchParams])

  const setQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (isActive) {
      params.delete('category')
    } else {
      params.set('category', String(category.id))
    }

    const newParams = params.toString()

    router.push(pathname + '?' + newParams)
  }, [category.id, isActive, pathname, router, searchParams])

  return (
    <li>
      <div
        className="flex items-start gap-2 py-1"
        style={{ paddingLeft: `${level * 14}px` }}
      >
        {category.children.length > 0 ? (
          <button
            type="button"
            aria-label={isExpanded ? 'Свий категорията' : 'Разгърни категорията'}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[rgb(1,55,186)]/70 transition hover:bg-[rgb(1,55,186)]/8 hover:text-[rgb(1,55,186)]"
            onClick={() => onToggleCategory(category.id)}
          >
            <ChevronRight
              className={clsx('h-4 w-4 transition-transform duration-300', {
                'rotate-90': isExpanded,
              })}
            />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}

        <button
          onClick={() => setQuery()}
          className={clsx('block text-left hover:cursor-pointer text-sm', {
            'font-medium underline': isActive,
            'text-primary/80': !isActive,
          })}
        >
          {category.title}
          {typeof category.productCount === 'number' ? (
            <span className="ml-2 text-xs text-muted-foreground">({category.productCount})</span>
          ) : null}
        </button>
      </div>

      {category.children.length > 0 ? (
        <CategoryChildren
          childrenNodes={category.children}
          expandedCategoryIDs={expandedCategoryIDs}
          isExpanded={isExpanded}
          level={level + 1}
          onToggleCategory={onToggleCategory}
        />
      ) : null}
    </li>
  )
}

export const CategoryTree: React.FC<TreeProps> = ({ categories }) => {
  const [expandedCategoryIDs, setExpandedCategoryIDs] = useState<Set<string>>(new Set())

  const onToggleCategory = useCallback((id: string) => {
    setExpandedCategoryIDs((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }, [])

  return (
    <ul>
      {categories.map((category) => {
        return (
          <CategoryItem
            key={category.id}
            category={category}
            expandedCategoryIDs={expandedCategoryIDs}
            onToggleCategory={onToggleCategory}
          />
        )
      })}
    </ul>
  )
}

export const CategoriesPanel: React.FC<PanelProps> = ({ categories }) => {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(true)
  const [maxHeight, setMaxHeight] = useState('none')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')

    const syncOpenState = () => {
      setIsOpen(mediaQuery.matches)
    }

    syncOpenState()
    mediaQuery.addEventListener('change', syncOpenState)

    return () => mediaQuery.removeEventListener('change', syncOpenState)
  }, [])

  useEffect(() => {
    if (!contentRef.current) return

    const updateHeight = () => {
      setMaxHeight(isOpen ? `${contentRef.current?.scrollHeight || 0}px` : '0px')
    }

    updateHeight()

    const observer = new ResizeObserver(() => {
      updateHeight()
    })

    observer.observe(contentRef.current)

    return () => {
      observer.disconnect()
    }
  }, [categories, isOpen])

  return (
    <section className="rounded-[6px] bg-[rgb(250,251,253)] px-5 py-5 md:px-6">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-[rgb(1,55,186)]/55" />
          <h3 className="text-sm font-normal tracking-[0.04em] text-[rgb(1,55,186)]">
            Категории
          </h3>
        </div>

        <ChevronDown
          className={clsx(
            'h-4 w-4 text-[rgb(1,55,186)] transition-transform duration-500 ease-in-out',
            {
              'rotate-180': isOpen,
            },
          )}
        />
      </button>

      <div
        className={clsx(
          'overflow-hidden transition-[max-height,opacity,margin-top] duration-500 ease-in-out',
          isOpen ? 'mt-4 opacity-100' : 'mt-0 opacity-0',
        )}
        style={{ maxHeight }}
      >
        <div ref={contentRef}>
          <CategoryTree categories={categories} />
        </div>
      </div>
    </section>
  )
}
