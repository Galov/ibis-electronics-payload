// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { withdrawalNotificationTask } from '@/orderWithdrawal/notifications'

const run = withdrawalNotificationTask.handler as Function
function context({
  customerSent = false,
  adminSent = false,
  recipients = ['admin@example.bg'],
} = {}) {
  const order = {
    id: '6a95adf4ec73a01c378fb4e4',
    customerEmail: 'client@example.bg',
    withdrawal: {
      requestedAt: '2026-10-13T12:00:00Z',
      status: 'pending',
      customerNotifiedAt: customerSent ? '2026-10-13T12:00:00Z' : null,
      adminNotifiedAt: adminSent ? '2026-10-13T12:00:00Z' : null,
    },
  }
  const payload = {
    findByID: vi.fn(async () => order),
    findGlobal: vi.fn(async () => ({
      notificationRecipients: recipients.map((email) => ({ email })),
    })),
    sendEmail: vi.fn(async () => {}),
    db: { updateOne: vi.fn(async () => order) },
  }
  return { input: { orderID: order.id }, req: { payload } }
}

describe('durable withdrawal notifications', () => {
  it('sends the Romanian receipt and Bulgarian admin notification, recording both deliveries', async () => {
    const args = context()
    expect(await run(args)).toEqual({ output: { sent: true } })
    expect(args.req.payload.sendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'client@example.bg',
        subject: expect.stringContaining('Записан отказ'),
      }),
    )
    expect(args.req.payload.sendEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: ['admin@example.bg'],
        subject: expect.stringContaining('Отказ от поръчка'),
      }),
    )
    expect(args.req.payload.db.updateOne).toHaveBeenCalledTimes(2)
    expect(
      args.req.payload.db.updateOne.mock.calls.every(
        ([args]: any[]) => args.collection === 'orders',
      ),
    ).toBe(true)
  })
  it('does not resend notifications already acknowledged', async () => {
    const args = context({ customerSent: true, adminSent: true })
    await run(args)
    expect(args.req.payload.sendEmail).not.toHaveBeenCalled()
  })
  it('retries a failed admin delivery without resending the customer receipt', async () => {
    const args = context({ customerSent: true })
    args.req.payload.sendEmail.mockRejectedValueOnce(new Error('provider unavailable'))
    await expect(run(args)).rejects.toThrow('provider unavailable')
    expect(args.req.payload.db.updateOne).not.toHaveBeenCalled()
  })
  it('surfaces missing admin recipients as a failed job rather than claiming success', async () => {
    const args = context({ customerSent: true, recipients: [] })
    await expect(run(args)).rejects.toThrow('Липсват получатели')
    expect(args.req.payload.sendEmail).not.toHaveBeenCalled()
  })
})
