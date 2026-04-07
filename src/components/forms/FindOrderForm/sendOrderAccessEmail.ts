'use server'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

type SendOrderAccessEmailArgs = {
  email: string
  orderID: string
}

type SendOrderAccessEmailResult = {
  success: boolean
  error?: string
}

export async function sendOrderAccessEmail({
  email,
  orderID,
}: SendOrderAccessEmailArgs): Promise<SendOrderAccessEmailResult> {
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
    const orderURL = `${serverURL}/orders/${order.id}?email=${encodeURIComponent(email)}&accessToken=${order.accessToken}`

    const emailBody = `
        <h1>Преглед на поръчката</h1>
        <p>Натиснете линка по-долу, за да видите детайлите за поръчката си:</p>
        <p><a href="${orderURL}">Преглед на поръчка #${order.id}</a></p>
        <p>Или копирайте и поставете този адрес в браузъра си:</p>
        <p>${orderURL}</p>
        <p>Този линк ще ви даде достъп до детайлите на поръчката.</p>
      `

    console.log('[sendOrderAccessEmail] Email body:', emailBody)

    await payload.sendEmail({
      to: email,
      subject: `Достъп до поръчка #${order.id}`,
      html: emailBody,
    })

    return { success: true }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to send order access email', err })
    return { success: true }
  }
}
