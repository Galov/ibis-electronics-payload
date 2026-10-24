'use server'

import { isLocale, localizeHref, type Locale } from '@/i18n/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

type SendOrderAccessEmailArgs = {
  email: string
  orderID: string
  locale?: Locale
}

type SendOrderAccessEmailResult = {
  success: boolean
  error?: string
}

export async function sendOrderAccessEmail({
  email,
  orderID,
  locale: requestedLocale,
}: SendOrderAccessEmailArgs): Promise<SendOrderAccessEmailResult> {
  const locale = isLocale(requestedLocale) ? requestedLocale : 'bg'
  const payload = await getPayload({ config: configPromise })

  try {
    const { docs: orders } = await payload.find({
      collection: 'orders',
      where: {
        and: [{ id: { equals: orderID } }, { customerEmail: { equals: email } }],
      },
      limit: 1,
      depth: 0,
    })

    const order = orders[0]

    if (!order || !order.accessToken) {
      return { success: true }
    }

    const serverURL = getServerSideURL()
    const orderURL = `${serverURL}${localizeHref(`/orders/${order.id}`, locale)}?email=${encodeURIComponent(email)}&accessToken=${order.accessToken}`

    const title = locale === 'en' ? 'View your order' : 'Преглед на поръчката'
    const instruction =
      locale === 'en'
        ? 'Use the link below to view your order details:'
        : 'Натиснете линка по-долу, за да видите детайлите за поръчката си:'
    const copy =
      locale === 'en'
        ? 'Or copy and paste this address into your browser:'
        : 'Или копирайте и поставете този адрес в браузъра си:'
    const notice =
      locale === 'en'
        ? 'This link provides access to your order details.'
        : 'Този линк ще ви даде достъп до детайлите на поръчката.'
    const safeURL = orderURL
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
    const emailBody = `
        <h1>${title}</h1>
        <p>${instruction}</p>
        <p><a href="${safeURL}">${title} #${order.id}</a></p>
        <p>${copy}</p>
        <p>${safeURL}</p>
        <p>${notice}</p>
      `

    await payload.sendEmail({
      to: email,
      subject: `${locale === 'en' ? 'Order access' : 'Достъп до поръчка'} #${order.id}`,
      html: emailBody,
    })

    return { success: true }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to send order access email', err })
    return { success: true }
  }
}
