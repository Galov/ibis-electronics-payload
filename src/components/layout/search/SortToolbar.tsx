'use client'

import { sorting } from '@/lib/constants'
import { createUrl } from '@/utilities/createUrl'
import { ArrowUpDown } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

type Props = {
  pageSize: number | 'all'
}

const pageSizeOptions = [8, 16, 24, 48, 96, 'all'] as const

export const SortToolbar: React.FC<Props> = ({ pageSize }) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentSort = searchParams.get('sort') || ''

  const onSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextSort = event.target.value

    if (nextSort) {
      nextParams.set('sort', nextSort)
    } else {
      nextParams.delete('sort')
    }

    nextParams.delete('page')

    router.push(createUrl(pathname, nextParams))
  }

  const onPageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextPageSize = event.target.value

    if (nextPageSize) {
      nextParams.set('limit', nextPageSize)
    } else {
      nextParams.delete('limit')
    }

    nextParams.delete('page')

    router.push(createUrl(pathname, nextParams))
  }

  return (
    <div className="flex flex-col gap-4 pt-5 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="grid grid-cols-[auto_1fr] items-center gap-3 text-[13px] text-primary/60 md:flex">
          <span>Покажи</span>
          <select
            className="h-10 w-[min(12rem,50vw)] justify-self-end rounded-xl border bg-white px-4 text-right text-[13px] text-primary/80 outline-none transition focus:border-[rgb(1,55,186)] md:w-[220px] md:min-w-[220px]"
            onChange={onPageSizeChange}
            value={String(pageSize)}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'Всички' : option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid grid-cols-[auto_1fr] items-center gap-3 text-[13px] text-primary/60 md:flex">
          <span className="inline-flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Сортиране
          </span>
          <select
            className="h-10 w-[min(12rem,50vw)] justify-self-end rounded-xl border bg-white px-4 text-right text-[13px] text-primary/80 outline-none transition focus:border-[rgb(1,55,186)] md:w-[220px] md:min-w-[220px]"
            onChange={onSortChange}
            value={currentSort}
          >
            {sorting.map((item) => (
              <option key={item.title} value={item.slug || ''}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
