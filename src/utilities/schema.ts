import { buildCategoryPath } from '@/utilities/category'
import { IBIS_CONTACT_LOCATION, IBIS_CONTACT_LOCATION_LABEL } from '@/constants/contact'
import { getBaseURL } from '@/utilities/getBaseURL'

type BreadcrumbItem = {
  name: string
  path: string
}

type CategoryLike = {
  parent?: null | CategoryLike | string
  title?: null | string
}

type ContactLocation = {
  address: string
  phone: string
  workingHours: string
}

type ContactPageLike = {
  store?: ContactLocation
}

const baseURL = getBaseURL()

const toAbsoluteUrl = (path: string) => `${baseURL}${path.startsWith('/') ? path : `/${path}`}`

const normalizePhone = (phone?: string | null) => {
  if (!phone) return undefined
  const normalized = phone.replace(/[^\d+]/g, '')
  return normalized || undefined
}

const buildPostalAddress = (address: string) => ({
  '@type': 'PostalAddress',
  addressCountry: 'BG',
  streetAddress: address,
})

export const buildBreadcrumbSchema = (items: BreadcrumbItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    item: toAbsoluteUrl(item.path),
    name: item.name,
    position: index + 1,
  })),
})

export const buildOrganizationSchema = (contactPage?: ContactPageLike | null) => {
  const phones = [contactPage?.store?.phone]
    .map((phone) => normalizePhone(phone))
    .filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    contactPoint: phones.map((phone) => ({
      '@type': 'ContactPoint',
      areaServed: 'BG',
      availableLanguage: ['bg'],
      contactType: 'customer support',
      telephone: phone,
    })),
    name: 'Ibis Electronics',
    url: baseURL,
  }
}

export const buildLocalBusinessSchemas = (contactPage?: ContactPageLike | null) => {
  const location = {
    address: IBIS_CONTACT_LOCATION.address,
    label: IBIS_CONTACT_LOCATION_LABEL,
    phone: contactPage?.store?.phone || '',
    workingHours: contactPage?.store?.workingHours || '',
  }

  return [({
    '@context': 'https://schema.org',
    '@type': 'Store',
    address: buildPostalAddress(location.address),
    areaServed: 'BG',
    name: location.label,
    openingHours: location.workingHours,
    telephone: normalizePhone(location.phone),
    url: toAbsoluteUrl('/contact'),
  })]
}

export const buildProductSchema = (args: {
  brand?: null | string
  category?: null | CategoryLike
  description?: null | string
  image?: null | string
  inStock: boolean
  name: string
  price: number
  sku?: null | string
  slug: string
}) => {
  const { brand, category, description, image, inStock, name, price, sku, slug } = args

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    ...(brand
      ? {
          brand: {
            '@type': 'Brand',
            name: brand,
          },
        }
      : {}),
    ...(category?.title
      ? {
          category: category.title,
        }
      : {}),
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    ...(sku ? { sku } : {}),
    name,
    offers: {
      '@type': 'Offer',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      price,
      priceCurrency: 'EUR',
      url: toAbsoluteUrl(`/products/${slug}`),
    },
  }
}

export const buildProductBreadcrumbItems = (args: {
  category?: null | CategoryLike
  productName: string
  productSlug: string
}) => {
  const items: BreadcrumbItem[] = [
    { name: 'Начало', path: '/' },
    { name: 'Каталог', path: '/shop' },
  ]

  const categoryChain: CategoryLike[] = []
  let current = args.category

  while (current && typeof current !== 'string' && current.title) {
    categoryChain.unshift(current)
    current = current.parent && typeof current.parent !== 'string' ? current.parent : null
  }

  for (const category of categoryChain) {
    if (!category.title) continue
    items.push({
      name: category.title,
      path: buildCategoryPath(category),
    })
  }

  items.push({
    name: args.productName,
    path: `/products/${args.productSlug}`,
  })

  return items
}

export const buildCategoryBreadcrumbItems = (args: { category: CategoryLike & { title: string } }) => {
  const items: BreadcrumbItem[] = [
    { name: 'Начало', path: '/' },
    { name: 'Каталог', path: '/shop' },
  ]

  const categoryChain: CategoryLike[] = []
  let current: CategoryLike | null = args.category

  while (current && typeof current !== 'string' && current.title) {
    categoryChain.unshift(current)
    current = current.parent && typeof current.parent !== 'string' ? current.parent : null
  }

  for (const category of categoryChain) {
    if (!category.title) continue
    items.push({
      name: category.title,
      path: buildCategoryPath(category),
    })
  }

  return items
}
