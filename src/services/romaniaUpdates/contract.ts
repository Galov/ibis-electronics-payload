import { createHash } from 'node:crypto'

export type UpdateKind = 'price' | 'stock'
export type RomaniaUpdateEvent = {
  schemaVersion: '1.3'
  eventId: string
  eventType: 'product.price_updated' | 'product.stock_updated'
  sourceRevision: number
  sourceUpdatedAt: string
  product:
    | { sourceProductId: string; sourcePriceEUR: number }
    | { sourceProductId: string; stockQty: number }
}

export const buildRomaniaUpdate = ({
  kind,
  productId,
  value,
  revision,
  updatedAt,
}: {
  kind: UpdateKind
  productId: string
  value: number
  revision: number
  updatedAt: string
}): RomaniaUpdateEvent => {
  if (
    !productId.trim() ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    !Number.isFinite(Date.parse(updatedAt))
  ) {
    throw new Error('INVALID_ROMANIA_UPDATE')
  }
  const body = {
    schemaVersion: '1.3' as const,
    eventType:
      kind === 'price' ? ('product.price_updated' as const) : ('product.stock_updated' as const),
    sourceRevision: revision,
    sourceUpdatedAt: new Date(updatedAt).toISOString(),
    product:
      kind === 'price'
        ? { sourceProductId: productId, sourcePriceEUR: value }
        : { sourceProductId: productId, stockQty: value },
  }
  return {
    ...body,
    eventId: `bg-${kind}-${createHash('sha256').update(JSON.stringify(body)).digest('hex')}`,
  }
}

export const validateRomaniaUpdate = (value: unknown): RomaniaUpdateEvent => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_ROMANIA_UPDATE')
  const event = value as RomaniaUpdateEvent
  if (
    event.schemaVersion !== '1.3' ||
    !['product.price_updated', 'product.stock_updated'].includes(event.eventType) ||
    !event.product ||
    typeof event.product.sourceProductId !== 'string'
  )
    throw new Error('INVALID_ROMANIA_UPDATE')
  const kind = event.eventType === 'product.price_updated' ? 'price' : 'stock'
  const canonical = buildRomaniaUpdate({
    kind,
    productId: event.product.sourceProductId,
    value:
      kind === 'price'
        ? (event.product as { sourcePriceEUR: number }).sourcePriceEUR
        : (event.product as { stockQty: number }).stockQty,
    revision: event.sourceRevision,
    updatedAt: event.sourceUpdatedAt,
  })
  const keys = (object: object) => Object.keys(object).sort().join(',')
  if (
    event.eventId !== canonical.eventId ||
    keys(event) !== keys(canonical) ||
    keys(event.product) !== keys(canonical.product) ||
    event.sourceUpdatedAt !== canonical.sourceUpdatedAt
  ) {
    throw new Error('INVALID_ROMANIA_UPDATE')
  }
  return canonical
}
