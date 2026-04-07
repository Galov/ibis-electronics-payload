type CategoryLike = {
  parent?: null | string | CategoryLike
  slug?: null | string
  title?: null | string
}

const normalizeCategorySegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' и ')
    .replace(/[^0-9a-zа-яёіїѝѐçüöäßæøå\s-]/giu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

export const buildCategorySlug = ({
  title,
}: {
  title: string
}) => normalizeCategorySegment(title)

export const buildCategorySegments = (category?: (CategoryLike | null) | null): string[] => {
  if (!category?.slug) return []

  const parent =
    category.parent && typeof category.parent !== 'string' ? buildCategorySegments(category.parent) : []

  return [...parent, category.slug]
}

export const buildCategoryPublicSegments = (category?: (CategoryLike | null) | null): string[] => {
  const segments = buildCategorySegments(category)

  return segments.reduce<string[]>((acc, segment) => {
    if (acc.length === 0) {
      acc.push(segment)
      return acc
    }

    acc.push(`${acc[acc.length - 1]}-${segment}`)
    return acc
  }, [])
}

export const buildCategoryPath = (category?: (CategoryLike | null) | null) => {
  const segments = buildCategoryPublicSegments(category)

  if (segments.length === 0) return '/shop'

  return `/cat/${segments.map(encodeURIComponent).join('/')}`
}
