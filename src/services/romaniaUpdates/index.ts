import type { Payload, PayloadRequest } from 'payload'
import type { Product, RomaniaUpdateStream } from '@/payload-types'
import { buildRomaniaUpdate, validateRomaniaUpdate, type UpdateKind } from './contract'
import { updateTransport, updatesEnabled, type UpdateTransport } from './transport'

const collection = 'romania-update-streams' as const
const terminal = new Set(['succeeded', 'superseded'])
const safeError = (error: unknown) =>
  error instanceof Error && /^ROMANIA_UPDATES_[A-Z_0-9]+$/.test(error.message)
    ? error.message
    : 'ROMANIA_UPDATES_DELIVERY_ERROR'

export async function deliverRomaniaUpdate({
  payload,
  id,
  transport = updateTransport(),
}: {
  payload: Payload
  id: string
  transport?: UpdateTransport
}) {
  if (!updatesEnabled()) return
  const stream = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
  if (terminal.has(stream.status)) return
  const now = new Date().toISOString()
  let patch: Partial<RomaniaUpdateStream>
  try {
    const event = validateRomaniaUpdate(stream.event)
    if (
      event.eventId !== stream.eventId ||
      event.sourceRevision !== stream.revision ||
      event.product.sourceProductId !== stream.sourceProductId ||
      event.eventType !== `product.${stream.kind}_updated`
    )
      throw new Error('ROMANIA_UPDATES_INVALID_EVENT')
    const product = await payload.findByID({
      collection: 'products',
      id: stream.sourceProductId,
      depth: 0,
      overrideAccess: true,
    })
    const stillCurrent =
      event.eventType === 'product.stock_updated'
        ? product.stockQty === (event.product as { stockQty: number }).stockQty
        : product.price === (event.product as { sourcePriceEUR: number }).sourcePriceEUR
    const status = !stillCurrent
      ? 'superseded'
      : stream.status === 'accepted'
        ? await transport.status(event.eventId)
        : await transport.send(event)
    patch = {
      status,
      lastAttemptedAt: now,
      lastErrorCode: status === 'failed' ? 'ROMANIA_UPDATES_REMOTE_FAILED' : null,
      lastErrorAt: status === 'failed' ? now : null,
      ...(terminal.has(status) ? { lastConfirmedAt: now } : {}),
    }
  } catch (error) {
    patch = {
      status: 'failed',
      lastAttemptedAt: now,
      lastErrorAt: now,
      lastErrorCode: safeError(error),
    }
  }
  // A slow response for revision A must never overwrite the journal for newer revision B.
  await payload.update({
    collection,
    where: {
      and: [
        { id: { equals: id } },
        { eventId: { equals: stream.eventId } },
        { status: { not_in: ['succeeded', 'superseded'] } },
      ],
    },
    data: patch,
    overrideAccess: true,
  })
}

async function recordChanges({
  req,
  previous,
  saved,
  stockProvided,
}: {
  req: PayloadRequest
  previous: Product
  saved: Product
  stockProvided: boolean
}) {
  // Only products already sent by the explicit content workflow are eligible.
  if (!previous.catalogSync?.lastSuccessfulEventId) return []
  const ids: string[] = []
  for (const kind of ['price', 'stock'] as UpdateKind[]) {
    if (kind === 'stock' && !stockProvided) continue
    const key = `${saved.id}:${kind}`
    const existing = await req.payload.find({
      collection,
      where: { key: { equals: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const stream = existing.docs[0]
    const value = kind === 'price' ? saved.price : saved.stockQty
    const oldValue = kind === 'price' ? previous.price : previous.stockQty
    if (value === oldValue) {
      if (stream && !terminal.has(stream.status)) ids.push(stream.id)
      continue
    }
    const revision = (stream?.revision || 0) + 1
    const event = buildRomaniaUpdate({
      kind,
      productId: saved.id,
      value: value as number,
      revision,
      updatedAt: saved.updatedAt,
    })
    const data = {
      key,
      kind,
      sourceProductId: saved.id,
      revision,
      eventId: event.eventId,
      event,
      status: 'pending' as const,
      lastErrorAt: null,
      lastErrorCode: null,
      lastAttemptedAt: null,
      lastConfirmedAt: null,
    }
    const record = stream
      ? await req.payload.update({ collection, id: stream.id, data, overrideAccess: true, req })
      : await req.payload.create({ collection, data, overrideAccess: true, req })
    ids.push(record.id)
  }
  return ids
}

export async function applyNikUpdateAndForward({
  req,
  productId,
  stockProvided,
  update,
}: {
  req: PayloadRequest
  productId: string | number
  stockProvided: boolean
  update: (request: PayloadRequest) => Promise<Product>
}): Promise<Product> {
  if (!updatesEnabled()) return update(req)
  if (req.transactionID) throw new Error('Romania forwarding must own the NIK update transaction')
  let saved: Product | undefined
  let ids: string[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    const transactionID = await req.payload.db.beginTransaction()
    if (!transactionID) throw new Error('Romania forwarding requires database transactions')
    // Keep the real Request (headers and Request methods are not enumerable).
    const txReq = req
    txReq.transactionID = transactionID
    try {
      const previous = await req.payload.findByID({
        collection: 'products',
        id: productId,
        depth: 0,
        overrideAccess: true,
        req: txReq,
      })
      saved = await update(txReq)
      ids = await recordChanges({ req: txReq, previous, saved, stockProvided })
      await req.payload.db.commitTransaction(transactionID)
      break
    } catch (error) {
      await req.payload.db.rollbackTransaction(transactionID)
      const code = (error as { code?: number })?.code
      if (attempt === 2 || ![112, 11000].includes(code || 0)) throw error
    } finally {
      delete txReq.transactionID
    }
  }
  if (!saved) throw new Error('NIK update did not complete')
  // Never hold the product transaction open across an external HTTP request.
  await Promise.all(
    ids.map(async (id) => {
      try {
        await deliverRomaniaUpdate({ payload: req.payload, id })
      } catch {
        req.payload.logger.error({
          msg: 'Romania update remains pending; retry required.',
          streamId: id,
        })
      }
    }),
  )
  return saved
}
