import { localizeHref, type Locale } from './config'

const escapeHTML = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
export function buildPasswordResetEmail(locale: Locale, token: string, origin: string) {
  const url = new URL(localizeHref('/forgot-password', locale), origin)
  url.searchParams.set('token', token)
  const title = locale === 'en' ? 'Reset your password' : 'Възстановяване на парола'
  const description =
    locale === 'en'
      ? 'Use the link below to set a new password. If you did not request a reset, you can ignore this email.'
      : 'Използвайте линка по-долу, за да зададете нова парола. Ако не сте заявили смяна, можете да пренебрегнете това съобщение.'
  return {
    subject: `${title} | Ibis Electronics`,
    html: `<h1>${title}</h1><p>${description}</p><p><a href="${escapeHTML(url.toString())}">${title}</a></p>`,
  }
}
