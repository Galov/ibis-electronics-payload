import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const login = vi.fn()
const onLogin = vi.fn()
const push = vi.fn()

vi.mock('@/providers/Auth', () => ({
  useAuth: () => ({ login }),
}))

vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useEcommerce: () => ({ onLogin }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('redirect=/checkout'),
}))

import { LoginForm } from '@/components/forms/LoginForm'

describe('LoginForm cart synchronization', () => {
  beforeEach(() => {
    login.mockReset()
    onLogin.mockReset()
    push.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('delegates guest cart synchronization to the ecommerce provider exactly once', async () => {
    login.mockResolvedValue({ id: 'user-1' })
    onLogin.mockResolvedValue(undefined)

    render(React.createElement(LoginForm))

    fireEvent.change(screen.getByLabelText('Имейл'), {
      target: { value: 'customer@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Парола'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Продължи' }))

    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1))

    expect(login).toHaveBeenCalledWith({
      email: 'customer@example.com',
      password: 'secret',
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/checkout')
  })
})
