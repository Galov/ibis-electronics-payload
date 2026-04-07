export type SortFilterItem = {
  reverse: boolean
  slug: null | string
  title: string
}

export const defaultSort: SortFilterItem = {
  slug: null,
  reverse: true,
  title: 'Най-нови',
}

export const sorting: SortFilterItem[] = [
  defaultSort,
  { slug: 'title', reverse: false, title: 'Азбучно А-Я' },
  { slug: 'priceInUSD', reverse: false, title: 'Цена: от ниска към висока' }, // asc
  { slug: '-priceInUSD', reverse: true, title: 'Цена: от висока към ниска' },
]
