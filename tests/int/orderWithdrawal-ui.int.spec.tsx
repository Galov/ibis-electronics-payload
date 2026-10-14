import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrderWithdrawal, GuestWithdrawalForm } from '@/components/OrderWithdrawal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('customer withdrawal UI', () => {
  it('does not submit when an email link is opened or the button is first clicked', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const view = render(<OrderWithdrawal token="signed-token" />)
    expect(screen.getByText('Потвърждавам отказа')).toBeDefined()
    expect(fetcher).not.toHaveBeenCalled()
    view.unmount()
    render(<OrderWithdrawal orderID="order-id" />)
    fireEvent.click(screen.getByText('Откажи поръчката'))
    expect(screen.getByText('Потвърждавам отказа')).toBeDefined()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('requires explicit confirmation and shows the recorded outcome', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'pending' }) }))
    vi.stubGlobal('fetch', fetcher)
    render(<OrderWithdrawal orderID="order-id" />)
    fireEvent.click(screen.getByText('Откажи поръчката'))
    fireEvent.click(screen.getByText('Потвърждавам отказа'))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Отказът е записан'),
    )
    expect(fetcher).toHaveBeenCalledWith(
      '/api/order-withdrawal/submit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ orderID: 'order-id', confirmed: true }),
      }),
    )
  })
  it('keeps the confirmation available after an error without claiming success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: 'Невалиден или изтекъл линк.' }),
      })),
    )
    render(<OrderWithdrawal token="expired-token" />)
    fireEvent.click(screen.getByText('Потвърждавам отказа'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('изтекъл'))
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('submits the guest identity only to the link endpoint', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
    vi.stubGlobal('fetch', fetcher)
    render(<GuestWithdrawalForm />)
    fireEvent.change(screen.getByLabelText('Номер на поръчката'), {
      target: { value: '6a95adf4ec73a01c378fb4e4' },
    })
    fireEvent.change(screen.getByLabelText('Имейлът, използван при поръчката'), {
      target: { value: 'client@example.bg' },
    })
    fireEvent.submit(screen.getByText('Изпрати линк за потвърждение').closest('form')!)
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Ако данните съответстват'),
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/order-withdrawal/link',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
