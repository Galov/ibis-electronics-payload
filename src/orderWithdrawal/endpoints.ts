import type { Order } from '@/payload-types'
import type { PayloadHandler, PayloadRequest } from 'payload'
import { createWithdrawalToken, verifyWithdrawalToken } from './token'
import { recordWithdrawal } from './service'
import { escapeHTML } from '@/ecommerce/orderEmailTemplates'
import { getServerSideURL } from '@/utilities/getURL'

const generic = () => Response.json({ ok: true })
const error = (status: number, message: string) => Response.json({ error: message }, { status })
const idIsValid = (id: unknown): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const sameOrigin = (req: PayloadRequest) => {
  const origin = req.headers.get('origin')
  return origin === new URL(getServerSideURL()).origin || origin === new URL(req.url!).origin
}
const attempts = new Map<string, { count: number; expires: number }>()
function rateAllowed(req: PayloadRequest) {
  const key =
    req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const now = Date.now()
  for (const [ip, entry] of attempts) if (entry.expires <= now) attempts.delete(ip)
  const entry = attempts.get(key) || { count: 0, expires: now + 600_000 }
  if (!attempts.has(key) && attempts.size >= 10000) return false
  entry.count++
  attempts.set(key, entry)
  return entry.count <= 10
}

export const requestWithdrawalLink: PayloadHandler = async (req) => {
  if (process.env.IBIS_LOCAL_PREVIEW === 'true')
    return error(503, 'Локален преглед: не се изпращат имейли и поръчките не се променят.')
  if (!sameOrigin(req)) return error(403, 'Непозволена заявка.')
  if (!rateAllowed(req))
    return error(429, 'Твърде много заявки. Опитайте отново след няколко минути.')
  try {
    const body = await req.json?.()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const orderID = typeof body?.orderID === 'string' ? body.orderID.trim() : ''
    if (!idIsValid(orderID) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return error(400, 'Въведете валиден номер на поръчката и имейл адрес.')
    // This server-only lookup deliberately returns the same response for missing/mismatched orders.
    const order = (
      await req.payload.find({
        collection: 'orders',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
        where: { and: [{ id: { equals: orderID } }, { customerEmail: { equals: email } }] },
      })
    ).docs[0]
    if (!order?.customerEmail) return generic()
    const cutoff = new Date(Date.now() - 300_000).toISOString()
    const claimed = await req.payload.db.updateOne({
      collection: 'orders',
      req,
      where: {
        and: [
          { id: { equals: order.id } },
          {
            or: [
              { withdrawalLinkSentAt: { exists: false } },
              { withdrawalLinkSentAt: { less_than: cutoff } },
            ],
          },
        ],
      },
      data: { withdrawalLinkSentAt: new Date().toISOString() },
    })
    if (!claimed) return generic()
    const token = createWithdrawalToken(order.id, order.customerEmail, req.payload.secret)
    const link = `${getServerSideURL()}/otkaz-porachka?token=${encodeURIComponent(token)}`
    await req.payload.sendEmail({
      to: order.customerEmail,
      subject: `Потвърдете отказа от поръчка #${order.id}`,
      html: `<h1>Отказ от поръчка</h1><p>Поискахте линк за отказ от поръчка #${escapeHTML(order.id)}.</p><p><a href="${escapeHTML(link)}">Отворете страницата за потвърждение</a></p><p>Отказът се записва след потвърждение на страницата. Линкът е валиден 24 часа; валидността му не променя законовия срок за отказ. Ако не сте направили тази заявка, игнорирайте съобщението.</p>`,
    })
    return generic()
  } catch {
    req.payload.logger.error({ msg: 'Withdrawal access email could not be sent' })
    return generic()
  }
}

export const submitWithdrawal: PayloadHandler = async (req) => {
  if (process.env.IBIS_LOCAL_PREVIEW === 'true')
    return error(503, 'Локален преглед: отказът не се изпраща и поръчката не се променя.')
  if (!sameOrigin(req)) return error(403, 'Непозволена заявка.')
  try {
    const body = await req.json?.()
    if (body?.confirmed !== true) return error(400, 'Потвърдете отказа.')
    const verified = verifyWithdrawalToken(body.token, req.payload.secret)
    const orderID = verified?.orderID || body.orderID
    if (!idIsValid(orderID) || (!verified && !req.user))
      return error(403, 'Невалиден или изтекъл линк. Поискайте нов линк.')
    // Owner access stays enforced for account requests. The signed email proof authorizes guest access only to this order.
    const load = async (): Promise<Order | undefined> => {
      const accessible = (
        await req.payload.find({
          collection: 'orders',
          depth: 0,
          limit: 1,
          req,
          ...(verified ? { overrideAccess: true } : { user: req.user, overrideAccess: false }),
          where: {
            and: [
              { id: { equals: orderID } },
              verified
                ? { customerEmail: { equals: verified.email } }
                : { customer: { equals: req.user!.id } },
            ],
          },
        })
      ).docs[0]
      if (!accessible) return undefined
      // The owner read hides NIK/admin fields. Load the complete state only after ownership proof.
      return req.payload.findByID({
        collection: 'orders',
        id: accessible.id,
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const order = await load()
      if (!order) return error(403, 'Нямате достъп до тази поръчка.')
      const result = await recordWithdrawal(req, order, verified ? 'email' : 'account')
      if (result) return Response.json({ ok: true, status: result })
    }
    return error(409, 'Поръчката е обновена. Опитайте отново.')
  } catch {
    req.payload.logger.error({ msg: 'Order withdrawal could not be recorded' })
    return error(503, 'Отказът не е записан. Опитайте отново или се свържете с Ибис Електроникс.')
  }
}
