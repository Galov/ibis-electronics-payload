import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RomanianStoreSuggestion } from '@/components/RomanianStoreSuggestion'
import { LocaleProvider } from '@/i18n/provider'
import {
  rememberStorefront,
  rememberedStorefront,
  STOREFRONT_CHOICE_COOKIE,
} from '@/i18n/storefrontPreference'

afterEach(() => {
  cleanup()
  document.cookie = `${STOREFRONT_CHOICE_COOKIE}=; Path=/; Max-Age=0`
})
const show = (eligible = true) =>
  render(
    <LocaleProvider locale="en">
      <RomanianStoreSuggestion eligible={eligible} />
    </LocaleProvider>,
  )
describe('Romanian store suggestion', () => {
  it('shows both languages, and navigates to Romania only using the explicit link', () => {
    show()
    expect(screen.getByText(/Se pare că ne vizitezi/).getAttribute('lang')).toBe('ro')
    expect(screen.getByText(/It looks like you/).getAttribute('lang')).toBe('en')
    expect(screen.getByRole('link', { name: /Visit Romanian store/ }).getAttribute('href')).toBe(
      'https://ibis-electronics.ro/',
    )
    expect(rememberedStorefront()).toBeNull()
  })
  it('remembers staying and does not show the prompt on the next page', () => {
    const view = show()
    fireEvent.click(screen.getByRole('button', { name: /Stay here/ }))
    expect(rememberedStorefront()).toBe('en')
    expect(screen.queryByRole('complementary')).toBeNull()
    view.unmount()
    show()
    expect(screen.queryByRole('complementary')).toBeNull()
  })
  it('responds immediately to a language switch and remembers a Romanian choice', () => {
    show()
    act(() => rememberStorefront('bg'))
    expect(screen.queryByRole('complementary')).toBeNull()
    act(() => rememberStorefront('ro'))
    expect(rememberedStorefront()).toBe('ro')
  })
  it('does not show to other visitors', () => {
    show(false)
    expect(screen.queryByRole('complementary')).toBeNull()
  })
})
