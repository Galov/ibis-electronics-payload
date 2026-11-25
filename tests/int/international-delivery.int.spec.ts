// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolveDelivery } from '@/ecommerce/deliveryCountry'
import {
  internationalDestinations,
  internationalPostalIssue,
} from '@/ecommerce/internationalDelivery'
import { getCheckoutDestination } from '@/ecommerce/checkoutDestination'
import {
  buildCustomerOrderEmailHTML,
  buildAdminOrderEmailHTML,
} from '@/ecommerce/orderEmailTemplates'

const standard = {
  shippingAddress: { country: 'DE', city: 'Berlin', postalCode: '10115', addressLine1: 'Test 1' },
  deliveryMethod: 'address',
  customerEmail: 'test@example.com',
}
describe('approved international flat rates', () => {
  it('has 23 destinations, card-only, and the approved final prices', () => {
    expect(Object.keys(internationalDestinations)).toHaveLength(23)
    for (const [country, { fee }] of Object.entries(internationalDestinations)) {
      expect(getCheckoutDestination(country)).toEqual({
        kind: 'international',
        country,
        shippingFee: fee,
        paymentMethods: ['revolut'],
      })
    }
    expect(internationalDestinations.GR.fee).toBe(7.42)
    expect(internationalDestinations.CY.fee).toBe(21.54)
    expect(internationalDestinations.HU.fee).toBe(10.67)
    expect(internationalDestinations.IT.fee).toBe(33.11)
    expect(internationalDestinations.SE.fee).toBe(65.93)
  })
  it('calculates delivery on the server without trusting the browser fee', () => {
    expect(resolveDelivery({ ...standard, ...{ shippingFee: -10000 } }, 'revolut')).toBe(23.99)
    expect(
      resolveDelivery(
        {
          ...standard,
          shippingAddress: { ...standard.shippingAddress, country: 'CY', postalCode: '1010' },
        },
        'revolut',
      ),
    ).toBe(21.54)
    expect(
      resolveDelivery({ shippingAddress: { country: 'BG' }, deliveryMethod: 'boxnow' }, 'manual'),
    ).toBe(1.54)
  })
  it('rejects manual payment, offices, other currencies, missing details and unapproved countries', () => {
    expect(() => resolveDelivery(standard, 'manual')).toThrow('online payment')
    expect(() =>
      resolveDelivery({ ...standard, deliveryMethod: 'speedy-office' }, 'revolut'),
    ).toThrow('address only')
    expect(() => resolveDelivery(standard, 'revolut', 'USD')).toThrow('EUR')
    expect(() =>
      resolveDelivery(
        { ...standard, customerEmail: 'guest-1@orders.ibiselectronics.local' },
        'revolut',
      ),
    ).toThrow('email')
    expect(() =>
      resolveDelivery(
        { ...standard, shippingAddress: { ...standard.shippingAddress, postalCode: '' } },
        'revolut',
      ),
    ).toThrow('postal')
    for (const country of ['RO', 'US', 'GB', 'CH', '']) {
      expect(() =>
        resolveDelivery(
          { ...standard, shippingAddress: { ...standard.shippingAddress, country } },
          'revolut',
        ),
      ).toThrow()
    }
  })
  it.each([
    ['DE', '18565'],
    ['DE', '25999'],
    ['NL', '1791 AA'],
    ['DK', '3900'],
    ['FR', '20000'],
    ['FI', '22100'],
    ['ES', '35001'],
    ['IT', '04020'],
    ['SE', '13025'],
    ['EE', '93001'],
  ] as const)('requires enquiry for excluded/surcharge destination %s %s', (country, code) => {
    expect(internationalPostalIssue(country, code)).toBe('enquiry')
    expect(() =>
      resolveDelivery(
        {
          ...standard,
          shippingAddress: { ...standard.shippingAddress, country, postalCode: code },
        },
        'revolut',
      ),
    ).toThrow('contact us')
  })
  it.each([
    ['DE', '10115'],
    ['NL', '1012 AB'],
    ['PL', '00-001'],
    ['PT', '1000-001'],
    ['LV', 'LV-1050'],
    ['LT', 'LT-01100'],
    ['CZ', '110 00'],
    ['HR', '10000'],
  ] as const)('accepts ordinary postal code %s %s', (country, code) => {
    expect(internationalPostalIssue(country, code)).toBeNull()
  })
})
describe('English customer email and Bulgarian admin email', () => {
  const args = {
    amount: 33.99,
    currency: 'EUR',
    shippingFee: 23.99,
    locale: 'en' as const,
    deliveryMethod: 'address' as const,
    paymentMethod: 'revolut' as const,
    orderID: '123',
    orderURL: 'https://example.test/en/orders/123',
    orderAdminURL: 'https://example.test/admin/collections/orders/123',
    shippingAddress: standard.shippingAddress,
    items: [
      {
        product: { title: 'Part <script>unsafe</script>' },
        productSKU: 'AB-123',
        productUnitPrice: 10,
        quantity: 1,
      },
    ],
  }
  it('translates all customer template text without changing codes or unescaped HTML', () => {
    const html = buildCustomerOrderEmailHTML(args)
    expect(html).toContain('lang="en"')
    expect(html).toContain('Order received')
    expect(html).toContain('Flat-rate international delivery')
    expect(html).toContain('/en/orders/123')
    expect(html).toContain('AB-123')
    expect(html).toContain('&lt;script&gt;unsafe&lt;/script&gt;')
    expect(html).not.toMatch(/[А-Яа-я]/)
    expect(html).not.toContain('paid on receipt')
  })
  it('keeps Bulgarian defaults and admin copy, including international fee explanation', () => {
    expect(buildCustomerOrderEmailHTML({ ...args, locale: undefined })).toContain(
      'Поръчката е приета',
    )
    const admin = buildAdminOrderEmailHTML(args)
    expect(admin).toContain('lang="bg"')
    expect(admin).toContain('Нова поръчка')
    expect(admin).toContain('Фиксирана международна доставка')
    expect(admin).not.toContain('се заплаща при получаване')
  })
})
