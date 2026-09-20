import type { PayloadHandler } from 'payload'
import { sendNikOrder } from '@/services/nikOrders'

export const nikOrderRetry: PayloadHandler = async (req) => {
  if (!req.user?.roles?.includes('admin'))
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const body = await req.json?.()
    const id = req.routeParams?.id
    if (
      typeof id !== 'string' ||
      typeof body?.reason !== 'string' ||
      !body.reason.trim() ||
      body.reason.length > 2000 ||
      !(body.expectedAttemptId === null || typeof body.expectedAttemptId === 'string')
    )
      return Response.json({ error: 'Невалидно основание или опит.' }, { status: 400 })
    await sendNikOrder(req.payload, id, {
      actor: req.user.id,
      reason: body.reason.trim(),
      expectedAttemptId: body.expectedAttemptId,
    })
    return Response.json({ ok: true })
  } catch {
    return Response.json(
      {
        error:
          'Изпращането не приключи. Обновете поръчката и проверете статуса, плащането и конфигурацията.',
      },
      { status: 409 },
    )
  }
}
