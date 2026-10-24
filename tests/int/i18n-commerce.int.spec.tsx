import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocaleProvider } from '@/i18n/provider'
import { translateCommerce, translateCommerceError } from '@/i18n/commerce'
import { safeReturnHref } from '@/i18n/config'
import { getPageLocale } from '@/i18n/pageLocale'
import { buildPasswordResetEmail } from '@/i18n/authEmail'
import { assertDomesticDelivery } from '@/ecommerce/deliveryCountry'
import commerceEnglish from '@/i18n/commerce.en.json'
import privacyEnglish from '@/i18n/content/privacy.en.json'
import termsEnglish from '@/i18n/content/terms.en.json'
import { translateInfoPage } from '@/i18n/content/translatePage'
import { contentFingerprint } from '@/i18n/content/fingerprint'
import { AddressForm } from '@/components/forms/AddressForm'
import { LoginForm } from '@/components/forms/LoginForm'
import { ResetPasswordForm } from '@/components/forms/ForgotPasswordForm/ResetPasswordForm'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  login: vi.fn(),
  onLogin: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams('redirect=/checkout'),
}))
vi.mock('@/providers/Auth', () => ({ useAuth: () => ({ login: mocks.login }) }))
vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useEcommerce: () => ({ onLogin: mocks.onLogin }),
  useAddresses: () => ({ createAddress: mocks.createAddress, updateAddress: mocks.updateAddress }),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
const english = (children: React.ReactNode) => (
  <LocaleProvider locale="en">{children}</LocaleProvider>
)

describe('English checkout and account boundaries', () => {
  it('preserves interpolation arguments in every commerce message', () => {
    for (const [source, translated] of Object.entries(commerceEnglish)) {
      expect((translated.match(/\{\d+\}/g) || []).sort()).toEqual(
        (source.match(/\{\d+\}/g) || []).sort(),
      )
      expect(translated.trim()).not.toBe('')
    }
  })
  it('includes all numbered articles in the legal translations without Bulgarian text fallback', () => {
    const terms = termsEnglish.join('\n')
    for (let i = 1; i <= 26; i++) expect(terms).toContain(`Article ${i}.`)
    const privacy = JSON.stringify(privacyEnglish)
    for (let i = 1; i <= 22; i++) expect(privacy).toContain(`Article ${i}.`)
    expect(privacy).not.toMatch(/[А-Яа-я]/)
    expect(terms).toContain('205880923')
    expect(privacy).toContain('205880923')
  })
  it('retains source-language spacing around inline account links', () => {
    expect(translateCommerce('en', 'constructor')).toBe('constructor')
    expect(translateCommerce('en', 'Промени данните на профила си по-долу или ')).toBe(
      'Update your account details below or ',
    )
    expect(translateCommerce('bg', ' за смяна на паролата.')).toBe(' за смяна на паролата.')
    expect(translateCommerceError('en', 'Непозната сървърна грешка')).not.toMatch(/[А-Яа-я]/)
  })
  it('rejects external sign-in return targets and preserves a local query', () => {
    for (const target of ['https://example.com', '//example.com', '/\\example.com'])
      expect(safeReturnHref(target, 'en')).toBe('/en/account')
    expect(safeReturnHref('/checkout?q=IC%20NE555#contact', 'en')).toBe(
      '/en/checkout?q=IC%20NE555#contact',
    )
    expect(safeReturnHref('/en/account', 'bg')).toBe('/account')
    expect(safeReturnHref('/contact', 'en')).toBe('/en/kontakti')
    expect(safeReturnHref('/shop?q=IC', 'en')).toBe('/en?q=IC')
  })
  it('gets the server page language explicitly, with a Bulgarian default', async () => {
    expect(await getPageLocale()).toBe('bg')
    expect(await getPageLocale(Promise.resolve({ locale: 'en' }))).toBe('en')
  })
  it('keeps Bulgaria-only delivery independent from the billing country', () => {
    expect(() => assertDomesticDelivery({ shippingAddress: { country: 'DE' } })).toThrow()
    expect(() =>
      assertDomesticDelivery({
        billingAddress: { country: 'DE' },
        shippingAddress: { country: 'BG' },
      }),
    ).not.toThrow()
    expect(() => assertDomesticDelivery({ billingAddress: { country: ' bg ' } })).not.toThrow()
  })
  it('localizes the password email link and escapes hostile token characters', () => {
    const email = buildPasswordResetEmail('en', '"><script>&', 'https://shop.example')
    expect(email.subject).toContain('Reset your password')
    expect(email.html).toContain('https://shop.example/en/forgot-password?token=')
    expect(email.html).not.toContain('<script>')
    expect(buildPasswordResetEmail('bg', 'token', 'https://shop.example').html).toContain(
      'https://shop.example/forgot-password?token=token',
    )
  })
  it('preserves domestic address data while rendering English validation', async () => {
    const callback = vi.fn()
    render(english(<AddressForm callback={callback} />))
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }))
    await screen.findByText('Region is required.')
    expect(mocks.createAddress).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Region*'), { target: { value: 'Sofia' } })
    fireEvent.change(screen.getByLabelText('Town or city*'), { target: { value: 'Sofia' } })
    fireEvent.change(screen.getByLabelText('Address line 1*'), { target: { value: '19 Levski-V' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }))
    await waitFor(() =>
      expect(mocks.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'BG', city: 'Sofia', addressLine1: '19 Levski-V' }),
      ),
    )
  })
  it('returns to English checkout after sign-in without bypassing cart synchronization', async () => {
    mocks.login.mockResolvedValue({ id: 'customer' })
    mocks.onLogin.mockResolvedValue(undefined)
    render(english(<LoginForm />))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/en/checkout'))
    expect(mocks.onLogin).toHaveBeenCalledTimes(1)
  })
  it('does not reset a password until confirmation matches', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetcher)
    render(english(<ResetPasswordForm token="signed-token" />))
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    await screen.findByText('Passwords do not match')
    expect(fetcher).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'new-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    await screen.findByText('Your password has been reset. Sign in with your new password.')
    expect(fetcher).toHaveBeenCalledWith(
      '/api/users/reset-password',
      expect.objectContaining({
        body: JSON.stringify({ token: 'signed-token', password: 'new-password' }),
      }),
    )
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/en/login')
  })
  it('requires review for newly edited authored text and preserves identifiers and URLs', () => {
    const source = {
      title: 'За нас',
      id: 'fixed-id',
      url: '/serviz',
      layout: [{ text: 'Ново непознато съдържание' }],
    }
    const result = translateInfoPage(source)
    expect(result.complete).toBe(false)
    expect(result.page.title).toBe('About us')
    expect(result.page.url).toBe('/serviz')
    expect(source.title).toBe('За нас')
    expect(contentFingerprint({ a: 1, b: 2 })).toBe(contentFingerprint({ b: 2, a: 1 }))
    expect(contentFingerprint({ a: 2, b: 2 })).not.toBe(contentFingerprint({ a: 1, b: 2 }))
  })
})
