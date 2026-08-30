import type { Payload } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

import type { CatalogSyncProductDocument } from './manual'

const escapeHTML = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

export const sendCatalogSyncFailureEmail = async ({
  error,
  errorAt,
  eventId,
  payload,
  product,
}: {
  error: string
  errorAt: string
  eventId: string
  payload: Payload
  product: CatalogSyncProductDocument
}) => {
  const orderSettings = await payload.findGlobal({
    slug: 'order-settings',
    depth: 0,
    overrideAccess: true,
  })
  const recipients = (orderSettings.notificationRecipients || [])
    .map((recipient) => recipient.email?.trim())
    .filter((email): email is string => Boolean(email))

  if (recipients.length === 0) {
    payload.logger.warn(
      `Catalog sync failed for product ${String(product.id)}, but no notification recipients are configured.`,
    )
    return
  }

  const title = product.title?.trim() || product.sku?.trim() || String(product.id)
  const adminURL = `${getServerSideURL()}/admin/collections/products/${encodeURIComponent(String(product.id))}`
  const subject = `Грешка при изпращане към румънския сайт: ${title}`
  const text = [
    `Продуктът „${title}“ не беше обработен успешно от румънския сайт.`,
    `Event ID: ${eventId}`,
    `Час: ${errorAt}`,
    `Грешка: ${error}`,
    `Провери продукта: ${adminURL}`,
  ].join('\n')
  const html = `
    <h1>${escapeHTML(subject)}</h1>
    <p>Нужна е човешка проверка на синхронизацията към румънския каталог.</p>
    <p><strong>Продукт:</strong> ${escapeHTML(title)}</p>
    <p><strong>Event ID:</strong> ${escapeHTML(eventId)}</p>
    <p><strong>Час:</strong> ${escapeHTML(errorAt)}</p>
    <p><strong>Грешка:</strong> ${escapeHTML(error)}</p>
    <p><a href="${escapeHTML(adminURL)}">Отвори продукта в админ панела</a></p>
  `

  const results = await Promise.allSettled(
    recipients.map((recipient) => payload.sendEmail({ html, subject, text, to: recipient })),
  )
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    throw new Error(`Failed to send ${failures.length} catalog sync failure notification(s).`)
  }
}
