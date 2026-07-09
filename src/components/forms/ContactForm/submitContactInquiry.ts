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
  submittedAt: number
  website?: string
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

const MIN_SUBMIT_DELAY_MS = 2500
const MAX_MESSAGE_LENGTH = 4000
const MAX_NAME_LENGTH = 120
const MAX_PHONE_LENGTH = 40
const MAX_LINK_COUNT = 2

const countLinks = (value: string) => {
  const matches = value.match(/https?:\/\//gi)
  return matches ? matches.length : 0
}

const hasSuspiciousContent = ({
  email,
  message,
  name,
  phone,
}: {
  email: string
  message: string
  name: string
  phone?: string
}) => {
  const normalizedMessage = message.trim().toLowerCase()
  const normalizedName = name.trim().toLowerCase()
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPhone = phone?.trim() || ''
  const suspiciousPatterns = [
    'viagra',
    'casino',
    'crypto',
    'forex',
    'seo service',
    'backlinks',
    'telegram',
    'whatsapp',
  ]

  if (
    !normalizedName ||
    !normalizedMessage ||
    !normalizedEmail ||
    name.length > MAX_NAME_LENGTH ||
    normalizedMessage.length > MAX_MESSAGE_LENGTH ||
    normalizedPhone.length > MAX_PHONE_LENGTH
  ) {
    return true
  }

  if (countLinks(normalizedMessage) > MAX_LINK_COUNT) {
    return true
  }

  if (suspiciousPatterns.some((pattern) => normalizedMessage.includes(pattern))) {
    return true
  }

  if (normalizedName.includes('http') || normalizedEmail.includes('http') || normalizedPhone.includes('http')) {
    return true
  }

  return false
}

export async function submitContactInquiry({
  email,
  message,
  name,
  phone,
  privacyAccepted,
  submittedAt,
  website,
}: SubmitContactInquiryArgs): Promise<SubmitContactInquiryResult> {
  const payload = await getPayload({ config: configPromise })
  const normalizedWebsite = website?.trim() || ''
  const now = Date.now()
  const submitDelay = Number.isFinite(submittedAt) ? now - submittedAt : 0

  if (normalizedWebsite) {
    payload.logger.warn('Contact inquiry blocked by honeypot field.')
    return { success: true }
  }

  if (submitDelay < MIN_SUBMIT_DELAY_MS) {
    payload.logger.warn({ msg: 'Contact inquiry blocked because it was submitted too quickly.', submitDelay })
    return {
      success: false,
      error: 'Формата беше изпратена твърде бързо. Моля, изчакайте малко и опитайте отново.',
    }
  }

  if (hasSuspiciousContent({ email, message, name, phone })) {
    payload.logger.warn({ msg: 'Contact inquiry blocked by anti-spam content validation.', email, name })
    return {
      success: false,
      error: 'Запитването изглежда невалидно. Моля, прегледайте въведените данни и опитайте отново.',
    }
  }

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
