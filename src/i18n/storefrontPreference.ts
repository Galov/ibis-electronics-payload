export const STOREFRONT_CHOICE_COOKIE = 'ibis-storefront-choice'
export const STOREFRONT_CHOICE_EVENT = 'ibis-storefront-choice-changed'
export const STOREFRONT_CHOICE_MAX_AGE = 180 * 24 * 60 * 60
export type StorefrontChoice = 'bg' | 'en' | 'ro'

export function parseStorefrontChoice(value?: string | null): StorefrontChoice | null {
  return value === 'bg' || value === 'en' || value === 'ro' ? value : null
}

export function rememberedStorefront(): StorefrontChoice | null {
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${STOREFRONT_CHOICE_COOKIE}=`))
  return parseStorefrontChoice(cookie?.slice(STOREFRONT_CHOICE_COOKIE.length + 1))
}

export function rememberStorefront(choice: StorefrontChoice) {
  document.cookie = `${STOREFRONT_CHOICE_COOKIE}=${choice}; Path=/; Max-Age=${STOREFRONT_CHOICE_MAX_AGE}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
  window.dispatchEvent(new Event(STOREFRONT_CHOICE_EVENT))
}
