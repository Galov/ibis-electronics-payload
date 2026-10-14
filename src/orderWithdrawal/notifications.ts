import type { TaskConfig } from 'payload'
import { escapeHTML } from '@/ecommerce/orderEmailTemplates'
import { getServerSideURL } from '@/utilities/getURL'

export const withdrawalNotificationTask: TaskConfig<{
  input: { orderID: string }
  output: { sent: boolean }
}> = {
  slug: 'notifyOrderWithdrawal',
  label: 'Известия при отказ от поръчка',
  inputSchema: [{ name: 'orderID', type: 'text', required: true }],
  outputSchema: [{ name: 'sent', type: 'checkbox', required: true }],
  concurrency: { key: ({ input }) => `withdrawal-${input.orderID}`, exclusive: true },
  retries: { attempts: 6, backoff: { delay: 60_000, type: 'exponential' } },
  handler: async ({ input, req }) => {
    const order = await req.payload.findByID({
      collection: 'orders',
      id: input.orderID,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (!order.withdrawal?.requestedAt) return { output: { sent: false } }
    const save = async (field: 'customerNotifiedAt' | 'adminNotifiedAt') => {
      const saved = await req.payload.db.updateOne({
        collection: 'orders',
        req,
        where: {
          and: [
            { id: { equals: order.id } },
            { 'withdrawal.status': { equals: order.withdrawal!.status } },
          ],
        },
        data: { withdrawal: { ...order.withdrawal, [field]: new Date().toISOString() } },
      })
      if (!saved) throw new Error('Withdrawal status changed; retry notification receipt')
      order.withdrawal![field] = new Date().toISOString()
    }
    const id = escapeHTML(order.id)
    const when = escapeHTML(order.withdrawal.requestedAt)
    if (!order.withdrawal.customerNotifiedAt && order.customerEmail) {
      await req.payload.sendEmail({
        to: order.customerEmail,
        subject: `Записан отказ от поръчка #${order.id}`,
        html: `<h1>Отказът е записан</h1><p>Поръчка: #${id}. Дата: ${when}.</p><p>${
          order.withdrawal.status === 'cancelled'
            ? 'Поръчката е отменена преди обработка.'
            : 'Ибис Електроникс ще обработи отказа и ще ви информира за стъпките за връщане и, когато е приложимо, възстановяване на сумата.'
        }</p><p>Преките разходи за връщане са за сметка на клиента. Това условие не ограничава законовите права при дефектна или несъответстваща стока.</p><p>Това потвърждение удостоверява заявения отказ; то не потвърждава получаването на върнатите стоки или възстановяването на сумата.</p>`,
      })
      await save('customerNotifiedAt')
    }
    if (!order.withdrawal.adminNotifiedAt) {
      const settings = await req.payload.findGlobal({
        slug: 'order-settings',
        depth: 0,
        overrideAccess: true,
        req,
      })
      const recipients =
        settings.notificationRecipients?.map(({ email }) => email).filter(Boolean) || []
      if (!recipients.length)
        throw new Error('Липсват получатели за известия при отказ от поръчка.')
      await req.payload.sendEmail({
        to: recipients,
        subject: `Отказ от поръчка #${order.id}`,
        html: `<h1>Отказ от поръчка #${id}</h1><p>Заявен на: ${when}</p><p>${order.withdrawal.status === 'cancelled' ? 'Поръчката е отменена преди обработка.' : 'Необходима е обработка на връщането и евентуалното възстановяване на сумата.'}</p><p>Количествата не са променени. Заприхождаването се извършва от NIK през Microinvest след връщането.</p><p><a href="${escapeHTML(`${getServerSideURL()}/admin/collections/orders/${order.id}`)}">Отвори поръчката</a></p>`,
      })
      await save('adminNotifiedAt')
    }
    return { output: { sent: true } }
  },
}
