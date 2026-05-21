import { buildCategoryPath } from '@/utilities/category'
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

type PostCategoryLike = {
  title?: null | string
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
    address: contactPage?.store?.address || '',
    label: 'Ибис Електроникс',
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
    url: toAbsoluteUrl('/kontakti'),
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
  const shippingDestination = {
    '@type': 'DefinedRegion',
    addressCountry: 'BG',
  }
  const deliveryTime = {
    '@type': 'ShippingDeliveryTime',
    handlingTime: {
      '@type': 'QuantitativeValue',
      minValue: 0,
      maxValue: 1,
      unitCode: 'DAY',
    },
    transitTime: {
      '@type': 'QuantitativeValue',
      minValue: 1,
      maxValue: 3,
      unitCode: 'DAY',
    },
  }

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
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'BG',
        merchantReturnDays: 14,
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      },
      price,
      priceCurrency: 'EUR',
      shippingDetails: [
        {
          '@type': 'OfferShippingDetails',
          deliveryTime,
          shippingDestination,
          shippingRate: {
            '@type': 'MonetaryAmount',
            currency: 'EUR',
            value: 6,
          },
        },
        {
          '@type': 'OfferShippingDetails',
          deliveryTime,
          shippingDestination,
          shippingRate: {
            '@type': 'MonetaryAmount',
            currency: 'EUR',
            value: 5,
          },
        },
      ],
      url: toAbsoluteUrl(`/products/${slug}`),
    },
  }
}

export const buildBlogPostingSchema = (args: {
  categories?: null | PostCategoryLike[]
  description?: null | string
  image?: null | string
  publishedAt?: null | string
  slug: string
  title: string
  updatedAt?: null | string
}) => {
  const { categories, description, image, publishedAt, slug, title, updatedAt } = args
  const articleSection = categories
    ?.map((category) => category?.title?.trim())
    .filter((category): category is string => Boolean(category))

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    ...(articleSection?.length ? { articleSection } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    ...(publishedAt ? { datePublished: publishedAt } : {}),
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    author: {
      '@type': 'Organization',
      name: 'Ibis Electronics',
    },
    headline: title,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': toAbsoluteUrl(`/blog/${slug}`),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ibis Electronics',
      url: baseURL,
    },
    url: toAbsoluteUrl(`/blog/${slug}`),
  }
}

export const buildProductBreadcrumbItems = (args: {
  category?: null | CategoryLike
  productName: string
  productSlug: string
}) => {
  const items: BreadcrumbItem[] = [
    { name: 'Начало', path: '/' },
    { name: 'Каталог', path: '/magazin' },
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
    { name: 'Каталог', path: '/magazin' },
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
