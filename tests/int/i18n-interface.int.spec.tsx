import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LocaleProvider } from '@/i18n/provider'
import { formatMessage, messages } from '@/i18n/messages'
import { Text } from '@/i18n/Text'
import { ShopBanner } from '@/components/shop/ShopBanner'
import { getProductImageAlt } from '@/utilities/product'
import { Price } from '@/components/Price'
import { StockIndicator } from '@/components/product/StockIndicator'
import { SortToolbar } from '@/components/layout/search/SortToolbar'
import { CookieConsentBanner } from '@/components/CookieConsent/Banner'
import { COOKIE_CONSENT_STORAGE_KEY } from '@/components/CookieConsent/shared'
import type { Product } from '@/payload-types'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/en/magazin',
  useSearchParams: () => new URLSearchParams('q=NE555&page=2'),
}))

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.clearAllMocks()
})

describe('translated storefront interface', () => {
  it('preserves placeholders and technical identifiers without interpreting them as markup', () => {
    expect(formatMessage('en', 'searchIn', { category: 'IC <NE555>' })).toBe('Search in IC <NE555>')
    const html = renderToStaticMarkup(
      <LocaleProvider locale="en">
        <Text id="searchIn" values={{ category: '<NE555>' }} />
      </LocaleProvider>,
    )
    expect(html).toContain('&lt;NE555&gt;')
    expect(formatMessage('bg', 'fewLeft', { count: 3 })).toBe('Остават само 3 в наличност')
    expect(formatMessage('en', 'resultsOne', { visible: 1, total: 1 })).toBe(
      'Showing 1 of 1 result for your selected criteria.',
    )
  })

  it('provides both languages for every interface message with matching placeholders', () => {
    const placeholders = (value: string) => (value.match(/\{\w+\}/g) || []).sort()
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.bg).sort())
    for (const key of Object.keys(messages.bg) as (keyof typeof messages.bg)[]) {
      expect(messages.en[key].trim()).not.toBe('')
      expect(placeholders(messages.en[key])).toEqual(placeholders(messages.bg[key]))
    }
  })

  it.each([
    ['en', 'Only 1 left in stock'],
    ['bg', 'Остава само 1 в наличност'],
  ] as const)('renders %s stock labels', (locale, expected) => {
    render(
      <LocaleProvider locale={locale}>
        <StockIndicator product={{ inventory: 1 } as Product} />
      </LocaleProvider>,
    )
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('formats prices by language while preserving the currency and value', () => {
    const html = (locale: 'bg' | 'en') =>
      renderToStaticMarkup(
        <LocaleProvider locale={locale}>
          <Price amount={1234.56} />
        </LocaleProvider>,
      )
    expect(html('en')).toContain(
      new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(1234.56),
    )
    expect(html('bg')).toContain(
      new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR' }).format(1234.56),
    )
  })

  it('keeps domestic promotional images out of the English storefront', () => {
    const banner = {
      image: { url: '/domestic-shipping.jpg', width: 800, height: 200, alt: 'Доставка в България' },
    }
    const html = (locale: 'bg' | 'en') =>
      renderToStaticMarkup(
        <LocaleProvider locale={locale}>
          <ShopBanner banner={banner as never} />
        </LocaleProvider>,
      )
    expect(html('en')).toBe('')
    expect(html('bg')).toContain('Доставка в България')
  })

  it('translates generated image labels and preserves supplied product content', () => {
    expect(getProductImageAlt({ productTitle: 'NE555', index: 1, locale: 'en' })).toBe(
      'NE555 - image 2',
    )
    expect(getProductImageAlt({ productTitle: 'NE555', index: 1 })).toBe('NE555 - изображение 2')
    expect(getProductImageAlt({ productTitle: 'NE555', imageAlt: 'NE555 5V', locale: 'en' })).toBe(
      'NE555 5V',
    )
  })

  it('changes sorting without dropping the English route or search term', () => {
    render(
      <LocaleProvider locale="en">
        <SortToolbar pageSize={16} />
      </LocaleProvider>,
    )
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'priceInUSD' } })
    expect(push).toHaveBeenCalledWith('/en/magazin?q=NE555&sort=priceInUSD')
    expect(screen.getByText('Price: low to high')).toBeTruthy()
    expect(screen.getByText('All')).toBeTruthy()
  })

  it('keeps consent persistence intact with translated controls', () => {
    render(
      <LocaleProvider locale="en">
        <CookieConsentBanner analyticsEnabled />
      </LocaleProvider>,
    )
    expect(screen.getByText('Cookie settings')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe('rejected')
    expect(screen.queryByText('Cookie settings')).toBeNull()
  })
})
