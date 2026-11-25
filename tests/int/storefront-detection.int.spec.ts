// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'
import { detectStorefront, shouldOfferRomanianStore } from '@/i18n/storefrontDetection'

const request = (
  path: string,
  country?: string,
  language?: string,
  choice?: string,
  userAgent = 'Mozilla/5.0',
) =>
  new NextRequest(`https://ibis-electronics.com${path}`, {
    headers: {
      ...(country ? { 'cf-ipcountry': country } : {}),
      ...(language ? { 'accept-language': language } : {}),
      ...(choice ? { cookie: `ibis-storefront-choice=${choice}` } : {}),
      'user-agent': userAgent,
    },
  })

describe('country and browser storefront selection', () => {
  it.each([
    ['BG', 'en-US,en;q=0.9', 'bg'],
    ['RO', 'bg-BG', 'ro'],
    ['DE', 'bg-BG', 'en'],
    ['US', 'ro-RO', 'en'],
    ['XX', 'ro-RO,en;q=0.8', 'ro'],
    ['T1', 'bg-BG', 'bg'],
    [null, 'en-US;q=0.4,bg;q=0.9', 'bg'],
    [null, 'fr-FR,en;q=0.8', 'en'],
    [null, 'ro;q=0,en;q=1', 'en'],
    [null, 'invalid;q=oops,bg;q=0.5', 'bg'],
    ['ZZ', 'ro-RO', 'ro'],
    [null, null, 'bg'],
  ])('selects for country %s and browser %s', (country, language, expected) => {
    expect(detectStorefront(country, language)).toBe(expected)
  })
  it.each([
    ['BG', 'en', '/magazin'],
    ['DE', 'bg', '/en'],
    ['RO', 'ro', '/en'],
  ])('negotiates only the neutral root for %s', (country, language, destination) => {
    const response = middleware(request('/?q=ABC123', country, language))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      `https://ibis-electronics.com${destination}?q=ABC123`,
    )
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('vary')).toContain('CF-IPCountry')
  })
  it.each([
    ['bg', '/magazin'],
    ['en', '/en'],
    ['ro', 'https://ibis-electronics.ro/'],
  ])('honors explicit remembered choice %s', (choice, destination) => {
    const response = middleware(request('/', 'RO', 'ro', choice))
    expect(response.headers.get('location')).toBe(
      destination.startsWith('/') ? `https://ibis-electronics.com${destination}` : destination,
    )
  })
  it.each([
    '/products/part-123',
    '/en/products/part-123',
    '/magazin',
    '/en',
    '/checkout',
    '/en/checkout',
  ])('preserves explicit page %s', (path) => {
    expect(middleware(request(path, 'DE', 'en', 'ro')).headers.get('location')).toBeNull()
  })
  it('does not offer Romania again after a manual choice or to crawlers', () => {
    const headers = request('/en', 'RO', 'en').headers
    expect(shouldOfferRomanianStore(headers)).toBe(true)
    for (const choice of ['bg', 'en', 'ro'])
      expect(shouldOfferRomanianStore(headers, choice)).toBe(false)
    expect(shouldOfferRomanianStore(request('/en', 'BG', 'ro').headers)).toBe(false)
    expect(shouldOfferRomanianStore(request('/en', 'XX', 'ro').headers)).toBe(true)
    expect(
      shouldOfferRomanianStore(request('/en', 'RO', 'ro', undefined, 'Googlebot').headers),
    ).toBe(false)
    expect(
      middleware(request('/', 'DE', 'en', undefined, 'Googlebot')).headers.get('location'),
    ).toBe('https://ibis-electronics.com/magazin')
  })
  it('retains canonical cleanup and never forwards add-to-cart to another page', () => {
    expect(
      middleware(request('/products/part/products/part', 'DE', 'en')).headers.get('location'),
    ).toBe('https://ibis-electronics.com/products/part')
    expect(middleware(request('/cat/a/cat/a', 'DE', 'en')).headers.get('location')).toBe(
      'https://ibis-electronics.com/cat/a',
    )
    expect(middleware(request('/?add-to-cart=1&q=test', 'DE', 'en')).headers.get('location')).toBe(
      'https://ibis-electronics.com/en?q=test',
    )
  })
})
