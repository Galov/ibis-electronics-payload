import { parseStorefrontChoice, type StorefrontChoice } from './storefrontPreference'

export function isSearchOrPreviewAgent(userAgent: string | null) {
  return /bot\b|crawler|spider|slurp|facebookexternalhit|google-inspectiontool/i.test(
    userAgent || '',
  )
}

function browserStorefront(acceptLanguage: string | null): StorefrontChoice {
  const preferences = (acceptLanguage || '')
    .split(',')
    .map((item, index) => {
      const [tag, ...parameters] = item.trim().split(';')
      const quality = parameters.find((value) => value.trim().startsWith('q='))
      const q = quality ? Number(quality.trim().slice(2)) : 1
      return { language: tag.toLowerCase().split('-')[0], q, index }
    })
    .filter((item) => /^[a-z]{2,8}$/.test(item.language) && item.q > 0 && item.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  if (!preferences.length) return 'bg'
  const first = preferences[0].language
  return first === 'bg' || first === 'ro' ? first : 'en'
}

export function detectStorefront(
  country: string | null,
  acceptLanguage: string | null,
): StorefrontChoice {
  const code = country?.trim().toUpperCase()
  if (code && /^[A-Z]{2}$/.test(code) && !['XX', 'ZZ'].includes(code))
    return code === 'BG' ? 'bg' : code === 'RO' ? 'ro' : 'en'
  return browserStorefront(acceptLanguage)
}

export function shouldOfferRomanianStore(headers: Headers, choice?: string | null) {
  return (
    !parseStorefrontChoice(choice) &&
    !isSearchOrPreviewAgent(headers.get('user-agent')) &&
    detectStorefront(headers.get('cf-ipcountry'), headers.get('accept-language')) === 'ro'
  )
}
