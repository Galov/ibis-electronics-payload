import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { createUrl } from '@/utilities/createUrl'

type SearchParams = { [key: string]: string | string[] | undefined }

type Props = {
  currentPage: number
  pathname: string
  searchParams: SearchParams
  totalPages: number
}

const buildPageHref = (pathname: string, searchParams: SearchParams, page: number) => {
  const nextParams = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'undefined') continue
    if (Array.isArray(value)) {
      value.forEach((item) => nextParams.append(key, item))
      continue
    }

    nextParams.set(key, value)
  }

  if (page <= 1) {
    nextParams.delete('page')
  } else {
    nextParams.set('page', String(page))
  }

  return createUrl(pathname, nextParams)
}

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1])

  if (currentPage <= 3) {
    pages.add(2)
    pages.add(3)
    pages.add(4)
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1)
    pages.add(totalPages - 2)
    pages.add(totalPages - 3)
  }

  const sortedPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)
  const items: Array<number | 'ellipsis'> = []

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1]

    if (previousPage && page - previousPage > 1) {
      items.push('ellipsis')
    }

    items.push(page)
  })

  return items
}

export const CatalogPagination: React.FC<Props> = ({
  currentPage,
  pathname,
  searchParams,
  totalPages,
}) => {
  if (totalPages <= 1) return null

  const items = buildPaginationItems(currentPage, totalPages)

  return (
    <Pagination className="mt-10">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            className={currentPage <= 1 ? 'pointer-events-none opacity-45' : ''}
            href={buildPageHref(pathname, searchParams, Math.max(1, currentPage - 1))}
          />
        </PaginationItem>

        {items.map((item, index) => (
          <PaginationItem key={`${item}-${index}`}>
            {item === 'ellipsis' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href={buildPageHref(pathname, searchParams, item)}
                isActive={item === currentPage}
              >
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            className={currentPage >= totalPages ? 'pointer-events-none opacity-45' : ''}
            href={buildPageHref(pathname, searchParams, Math.min(totalPages, currentPage + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
