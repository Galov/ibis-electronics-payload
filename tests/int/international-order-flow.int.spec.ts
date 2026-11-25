// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import {
  createCheckoutTransactionData,
  finalizeCheckoutTransaction,
} from '@/ecommerce/orderLifecycle'
const mocks = vi.hoisted(() => ({ create: vi.fn(), queue: vi.fn() }))
vi.mock('@/ecommerce/createCheckoutOrderOnce', () => ({ createCheckoutOrderOnce: mocks.create }))
vi.mock('@/services/nikOrders', () => ({ queueNikOrder: mocks.queue }))
vi.mock('@/utilities/getURL', () => ({ getServerSideURL: () => 'http://127.0.0.1:3108' }))

describe('international order snapshot and English notifications (mocked transport)', () => {
  const address = {
    country: 'DE',
    city: 'Berlin',
    postalCode: '10115',
    addressLine1: 'Example 1',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+49123456789',
  }
  const input = {
    cart: {
      id: 'cart-1',
      currency: 'EUR',
      subtotal: 10,
      items: [
        {
          product: { id: 'product-1', title: 'Българско име', sku: 'ABC', price: 10 },
          quantity: 1,
        },
      ],
    },
    checkoutData: {
      locale: 'en',
      shippingAddress: address,
      billingAddress: address,
      deliveryMethod: 'address',
      shippingFee: -100,
      customerEmail: 'jane@example.test',
    },
    paymentMethod: 'revolut',
  } as Parameters<typeof createCheckoutTransactionData>[0]
  it('saves approved freight, total and locale; rejects international manual checkout', () => {
    const snapshot = createCheckoutTransactionData(input)
    expect(snapshot.shippingFee).toBe(23.99)
    expect(snapshot.amount).toBe(33.99)
    expect(snapshot.locale).toBe('en')
    expect(snapshot.items[0].productSKU).toBe('ABC')
    expect(() => createCheckoutTransactionData({ ...input, paymentMethod: 'manual' })).toThrow(
      'online payment',
    )
  })
  it('keeps the paid snapshot and sends EN customer/BG admin emails with the correct order link', async () => {
    const snapshot = createCheckoutTransactionData(input)
    const transaction = { ...snapshot, id: 'tx-1' }
    mocks.create.mockResolvedValue({ id: 'order-1', accessToken: 'test-access' })
    const payload = {
      findByID: vi.fn().mockResolvedValue(transaction),
      find: vi.fn().mockResolvedValue({ docs: [{ id: 'product-1', title: 'English part' }] }),
      update: vi.fn().mockResolvedValue({}),
      findGlobal: vi
        .fn()
        .mockResolvedValue({ notificationRecipients: [{ email: 'admin@example.test' }] }),
      sendEmail: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }
    const req = { payload } as unknown as PayloadRequest
    await finalizeCheckoutTransaction({ req, transactionID: 'tx-1' })
    expect(mocks.create).toHaveBeenCalledWith(
      req,
      'tx-1',
      expect.objectContaining({
        locale: 'en',
        amount: 33.99,
        shippingFee: 23.99,
        shippingAddress: address,
      }),
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'products', locale: 'en', req }),
    )
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.test',
        subject: 'Order #order-1 | Ibis Electronics',
        html: expect.stringContaining('http://127.0.0.1:3108/en/orders/order-1?'),
      }),
    )
    const customer = payload.sendEmail.mock.calls.find(
      ([email]) => email.to === 'jane@example.test',
    )![0]
    expect(customer.html).toContain('English part')
    expect(customer.html).not.toContain('Българско име')
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@example.test', subject: 'Нова поръчка #order-1' }),
    )
  })
})
