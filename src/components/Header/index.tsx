import { hasEnglishRoute, type Locale } from '@/i18n/config'
import { translateCommerce } from '@/i18n/commerce'
import type { Category, Header as HeaderGlobal, Page, Post, Product } from '@/payload-types'

import { buildCategoryPath } from '@/utilities/category'
import { getCachedGlobal } from '@/utilities/getGlobals'

import { HeaderClient, type HeaderNavItem } from './index.client'

const fallbackNavItems: HeaderNavItem[] = [
  { href: '/magazin', id: 'products', label: 'Продукти' },
  { href: '/uslugi', id: 'services', label: 'Услуги' },
  { href: '/serviz', id: 'service', label: 'Сервиз' },
  { href: '/za-nas', id: 'about', label: 'За нас' },
  { href: '/kontakti', id: 'contacts', label: 'Контакти' },
]

type HeaderLink = NonNullable<NonNullable<HeaderGlobal['navItems']>[number]['link']>

const resolveReferenceHref = (reference: HeaderLink['reference']) => {
  if (!reference || typeof reference.value !== 'object' || !reference.value) return null

  if (reference.relationTo === 'categories') {
    return buildCategoryPath(reference.value as Category)
  }

  const value = reference.value as Page | Post | Product | { slug?: string | null }

  if (!value.slug) return null

  if (reference.relationTo === 'pages') return `/${value.slug}`
  if (reference.relationTo === 'posts') return `/blog/${value.slug}`

  return `/${reference.relationTo}/${value.slug}`
}

const normalizeNavItems = (navItems: HeaderGlobal['navItems']): HeaderNavItem[] => {
  if (!navItems?.length) return fallbackNavItems

  const normalizedItems = navItems
    .map((item, index): HeaderNavItem | null => {
      const href =
        item.link.type === 'reference'
          ? resolveReferenceHref(item.link.reference)
          : item.link.type === 'internal'
            ? item.link.internalPath || null
            : item.link.url || null

      if (!href || !item.link.label) return null

      return {
        href,
        id: item.id || `${href}-${index}`,
        label: item.link.label,
      }
    })
    .filter((item): item is HeaderNavItem => Boolean(item))

  return normalizedItems.length > 0 ? normalizedItems : fallbackNavItems
}

export async function Header({ locale = 'bg' }: { locale?: Locale }) {
  const header = (await getCachedGlobal('header', 1)()) as HeaderGlobal

  return (
    <HeaderClient
      navItems={normalizeNavItems(header.navItems)
        .filter((item) => {
          if (locale === 'bg') return true
          const url = new URL(item.href, 'https://ibis-electronics.com')
          const internal =
            item.href.startsWith('/') ||
            ['ibis-electronics.com', 'www.ibis-electronics.com'].includes(url.hostname)
          // Only show English destinations that have an implemented route.
          return !internal || hasEnglishRoute(url.pathname)
        })
        .map((item) => ({
          ...item,
          label: translateCommerce(locale, item.label),
        }))}
    />
  )
}
