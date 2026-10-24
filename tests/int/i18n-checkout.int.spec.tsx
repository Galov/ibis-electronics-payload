import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocaleProvider } from '@/i18n/provider'
import { CheckoutPage } from '@/components/checkout/CheckoutPage'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  clearCart: vi.fn(),
  confirmOrder: vi.fn(),
  addresses: [],
  cart: {
    id: 'cart-test',
    subtotal: 10,
    items: [
      {
        id: 'item-test',
        quantity: 1,
        product: {
          id: 'product-test',
          title: 'NE555 5V',
          slug: 'ne555',
          price: 10,
          inventory: 2,
          images: [],
        },
      },
    ],
  },
}))
vi.mock('@/providers/Auth', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useCart: () => ({ cart: mocks.cart, clearCart: mocks.clearCart }),
  useAddresses: () => ({ addresses: mocks.addresses }),
  usePayments: () => ({ confirmOrder: mocks.confirmOrder }),
}))
vi.mock('@/components/checkout/BoxNowOfficeSelector', () => ({
  BoxNowOfficeSelector: ({
    onSelect,
  }: {
    onSelect: (locker: {
      id: string
      name: string
      address: string
      postalCode: string
      latitude: string
      longitude: string
    }) => void
  }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          id: 'locker-test',
          name: 'Sofia',
          address: 'Test address',
          postalCode: '1000',
          latitude: '0',
          longitude: '0',
        })
      }
    >
      Choose test locker
    </button>
  ),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
})

describe('English guest checkout', () => {
  it('keeps submission disabled until contact and delivery are complete, then stays in English', async () => {
    mocks.confirmOrder.mockResolvedValue({
      orderID: 'order-test',
      accessToken: 'signed-order-token',
    })
    render(
      <LocaleProvider locale="en">
        <CheckoutPage />
      </LocaleProvider>,
    )
    expect(screen.getByText(/Delivery is currently available within Bulgaria only/)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Place order' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Smith' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+359888123456' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
    expect(
      (screen.getByRole('button', { name: 'Place order' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Choose test locker' }))
    expect(
      (screen.getByRole('button', { name: 'Place order' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
    await waitFor(() =>
      expect(mocks.confirmOrder).toHaveBeenCalledWith('manual', {
        additionalData: expect.objectContaining({
          locale: 'en',
          customerEmail: 'jane@example.com',
          deliveryMethod: 'boxnow',
          shippingFee: 1.54,
          shippingAddress: expect.objectContaining({
            country: 'BG',
            firstName: 'Jane',
            lastName: 'Smith',
          }),
        }),
      }),
    )
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        '/en/orders/order-test?email=jane%40example.com&accessToken=signed-order-token',
      ),
    )
    expect(mocks.clearCart).toHaveBeenCalledTimes(1)
  })
})
