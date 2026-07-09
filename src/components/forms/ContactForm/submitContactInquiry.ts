'use server'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

type SubmitContactInquiryArgs = {
  email: string
  message: string
  name: string
  phone?: string
  privacyAccepted: boolean
}

type SubmitContactInquiryResult = {
  error?: string
  success: boolean
}

type ContactPageSettings = {
  notificationRecipients?: Array<{
    email?: null | string
  }> | null
}

type ContactInquiryRecord = {
  id: string
}

const escapeHTML = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const formatValue = (value?: string) => {
  const trimmed = value?.trim()
  return trimmed ? escapeHTML(trimmed) : '-'
}

export async function submitContactInquiry({
  email,
  message,
  name,
  phone,
  privacyAccepted,
}: SubmitContactInquiryArgs): Promise<SubmitContactInquiryResult> {
  const payload = await getPayload({ config: configPromise })

  try {
    const inquiry = (await payload.create({
      collection: 'contact-inquiries' as never,
      data: {
        email,
        message,
        name,
        phone,
        privacyAccepted,
      } as never,
      overrideAccess: true,
    })) as ContactInquiryRecord

    try {
      const contactPage = (await payload.findGlobal({
        slug: 'contact-page' as never,
        depth: 0,
      })) as ContactPageSettings

      const recipients = (contactPage.notificationRecipients || [])
        .map((recipient) => recipient.email?.trim())
        .filter((recipient): recipient is string => Boolean(recipient))

      if (recipients.length > 0) {
        const serverURL = getServerSideURL()
        const inquiryAdminURL = `${serverURL}/admin/collections/contact-inquiries/${inquiry.id}`
        const html = `
          <h1>Ново контактно запитване</h1>
          <p>Получено е ново запитване през контактната форма на сайта.</p>
          <p><strong>Име:</strong> ${formatValue(name)}</p>
          <p><strong>Имейл:</strong> ${formatValue(email)}</p>
          <p><strong>Телефон:</strong> ${formatValue(phone)}</p>
          <p><strong>Съгласие с политиката:</strong> ${privacyAccepted ? 'Да' : 'Не'}</p>
          <p><strong>Съобщение:</strong></p>
          <p>${formatValue(message).replaceAll('\n', '<br />')}</p>
          <p><a href="${inquiryAdminURL}">Отвори запитването в админ панела</a></p>
        `

        await Promise.all(
          recipients.map((recipient) =>
            payload.sendEmail({
              html,
              subject: `Ново контактно запитване | ${name.trim() || email.trim()}`,
              to: recipient,
            }),
          ),
        )
      } else {
        payload.logger.warn(
          'No contact inquiry notification recipients configured; contact form email was skipped.',
        )
      }
    } catch (err) {
      payload.logger.error({ msg: 'Failed to send contact inquiry notification email', err })
    }

    return { success: true }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to create contact inquiry', err })
    return {
      success: false,
      error: 'Възникна проблем при изпращането на запитването. Моля, опитайте отново.',
    }
  }
}
