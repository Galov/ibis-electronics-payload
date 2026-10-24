import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getPathLocale, hasEnglishRoute, isLocale, localizeHref, stripLocale } from '@/i18n/config'
import { LocaleProvider } from '@/i18n/provider'
import Link from '@/i18n/Link'

describe('storefront language routing', () => {
  it('recognizes a complete English path segment only', () => {
    expect(getPathLocale('/en')).toBe('en')
    expect(getPathLocale('/en/products/part')).toBe('en')
    expect(getPathLocale('/engineering')).toBe('bg')
    expect(isLocale('ro')).toBe(false)
    expect(isLocale('bg')).toBe(true)
  })

  it('round trips page URLs without losing filters or fragment', () => {
    const bg = '/magazin?q=IC%20NE555&category=123#results'
    expect(localizeHref(bg, 'en')).toBe(`/en${bg}`)
    expect(localizeHref(`/en${bg}`, 'bg')).toBe(bg)
    expect(localizeHref(`/en${bg}`, 'en')).toBe(`/en${bg}`)
    expect(localizeHref('/', 'en')).toBe('/en')
    expect(localizeHref('/en?sort=price', 'bg')).toBe('/?sort=price')
    expect(stripLocale('/en/products/part')).toBe('/products/part')
  })

  it.each([
    'https://example.com/products/part',
    '//example.com/en',
    'mailto:sales@example.com',
    '#specifications',
    '?page=2',
    '/api/products',
    '/api',
    '/admin',
    '/admin/login',
    '/_next/image?url=test',
    '/logo.png',
    '/files/datasheet.pdf',
  ])('does not rewrite external, API, admin or asset URL %s', (href) => {
    expect(localizeHref(href, 'en')).toBe(href)
  })

  it('offers a language counterpart only for implemented route shapes', () => {
    expect(hasEnglishRoute('/en/products/part')).toBe(true)
    expect(hasEnglishRoute('/cat/parent/child')).toBe(true)
    expect(hasEnglishRoute('/checkout')).toBe(true)
    expect(hasEnglishRoute('/blog')).toBe(false)
    expect(hasEnglishRoute('/products/part/invalid')).toBe(false)
    expect(localizeHref('/products/model.v2', 'en')).toBe('/en/products/model.v2')
  })

  it('keeps first-party English navigation local while leaving the Romanian shop external', () => {
    expect(localizeHref('https://ibis-electronics.com/kategorii', 'en')).toBe('/en/kategorii')
    expect(localizeHref('https://ibis-electronics.ro/', 'en')).toBe('https://ibis-electronics.ro/')
    expect(localizeHref('https://ibis-electronics.com/api/products', 'en')).toBe(
      'https://ibis-electronics.com/api/products',
    )
  })

  it('renders shared product links using the server-provided locale', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider locale="en">
        <Link href="/products/part">Part</Link>
      </LocaleProvider>,
    )
    expect(html).toContain('href="/en/products/part"')
    const bg = renderToStaticMarkup(<Link href="/products/part">Part</Link>)
    expect(bg).toContain('href="/products/part"')
  })

  it('retains query objects when rendering a localized link', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider locale="en">
        <Link href={{ pathname: '/magazin', query: { q: 'NE555' } }}>Search</Link>
      </LocaleProvider>,
    )
    expect(html).toContain('href="/en/magazin?q=NE555"')
  })
})
