export type NikOrderRequest = {
  externalOrderId: string
  items: { sku: string; quantity: number }[]
}

export function buildNikOrderRequest(
  orderId: string,
  items: { productSKU?: string | null; quantity?: number | null }[],
): NikOrderRequest {
  const quantities = new Map<string, number>()
  if (!items.length) throw new Error('EMPTY_ORDER')
  for (const item of items) {
    const sku = item.productSKU
    if (!sku || sku.trim() !== sku || sku.length > 128 || /[\x00-\x1f\x7f]/.test(sku))
      throw new Error('INVALID_SKU')
    if (!Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0)
      throw new Error('INVALID_QUANTITY')
    const quantity = (quantities.get(sku) || 0) + Number(item.quantity)
    if (quantity > 1000000) throw new Error('INVALID_QUANTITY')
    quantities.set(sku, quantity)
  }
  if (quantities.size > 500 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,124}$/.test(orderId))
    throw new Error('INVALID_ORDER')
  return {
    externalOrderId: `BG:${orderId}`,
    items: [...quantities]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sku, quantity]) => ({ sku, quantity })),
  }
}

export type NikResult = {
  status: 'accepted' | 'manual_review' | 'retryable' | 'unknown'
  code: string
  orderId?: string
  details?: { sku: string; requested?: number; available?: number }[]
  microinvestStatus?: string
  stockSyncStatus?: string
}

const manualCodes = new Set([
  'INSUFFICIENT_STOCK',
  'INVALID_GROUP1_PRICE',
  'SKU_NOT_FOUND',
  'SKU_AMBIGUOUS',
  'PRODUCT_DATA_INCOMPLETE',
  'INVALID_ORDER_TOTAL',
  'INVALID_QUANTITY',
  'DUPLICATE_ITEM_SKU',
  'INVALID_SKU',
  'INVALID_REQUEST',
  'INVALID_EXTERNAL_ORDER_ID',
  'INVALID_ITEMS',
  'INVALID_ITEM',
  'IDEMPOTENCY_CONFLICT',
])

export async function postNikOrder(
  body: NikOrderRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<NikResult> {
  if (process.env.NIK_ORDERS_SEND_ENABLED !== 'true') throw new Error('NIK_ORDERS_SEND_DISABLED')
  const key = process.env.NIK_ORDERS_API_KEY
  if (!key) return { status: 'retryable', code: 'NIK_KEY_MISSING' }
  try {
    const response = await fetchImpl('https://nikelectric.com/api/integrations/ibis/orders', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(90000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if ([200, 201].includes(response.status)) {
      if (
        data?.acceptanceStatus !== 'accepted' ||
        data.externalOrderId !== body.externalOrderId ||
        typeof data.orderId !== 'string' ||
        !data.orderId ||
        typeof data.replayed !== 'boolean'
      )
        return { status: 'unknown', code: 'INVALID_NIK_RESPONSE' }
      const deliveryStatuses = ['pending', 'sending', 'sent', 'failed', 'unknown', 'unavailable']
      return {
        status: 'accepted',
        code: '',
        orderId: data.orderId,
        microinvestStatus: deliveryStatuses.includes(data.microinvestExport?.status)
          ? data.microinvestExport.status
          : 'unavailable',
        stockSyncStatus: deliveryStatuses.includes(data.ibisStockSync?.status)
          ? data.ibisStockSync.status
          : 'unavailable',
      }
    }
    const code = data?.error?.code
    if ([400, 409, 422].includes(response.status) && manualCodes.has(code)) {
      const skus = new Set(body.items.map((item) => item.sku))
      const details = (Array.isArray(data.error.details) ? data.error.details : [])
        .filter((item: { sku?: unknown }) => typeof item?.sku === 'string' && skus.has(item.sku))
        .map((item: { sku: string; requested?: number; available?: number }) => ({
          sku: item.sku,
          ...(Number.isFinite(item.requested) ? { requested: item.requested } : {}),
          ...(Number.isFinite(item.available) ? { available: item.available } : {}),
        }))
      return { status: 'manual_review', code, details }
    }
    return {
      status: [401, 403].includes(response.status) ? 'retryable' : 'unknown',
      code: `NIK_HTTP_${response.status}`,
    }
  } catch {
    // A lost acknowledgement does not prove rejection. Retry the immutable request.
    return { status: 'unknown', code: 'NIK_RESPONSE_UNCONFIRMED' }
  }
}
