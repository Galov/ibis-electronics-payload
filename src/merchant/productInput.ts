import type { Product } from '@/payload-types'
import { formatLegacyProductDescription } from '@/utilities/formatLegacyProductDescription'
import { isVisibleProduct, resolveProductImageURL } from '@/utilities/product'

export const merchantAccountId = '173890950'
export const merchantDataSourceId = '10757705357'
export const merchantOfferId = (id: string) => `ibis-bg-${id}`
export const merchantProductKey = (id: string) => `bg~BG~${merchantOfferId(id)}`

export type MerchantInput = {
  offerId: string
  contentLanguage: 'bg'
  feedLabel: 'BG'
  productAttributes: {
    title: string
    description: string
    link: string
    imageLink: string
    additionalImageLinks?: string[]
    availability: 'IN_STOCK'
    price: { amountMicros: string; currencyCode: 'EUR' }
    brand?: string
    mpn?: string
  }
}

// Match the storefront visibility and stored retail price, not source EUR prices.
// Never infer GTIN, condition, delivery costs or identifierExists from missing data.
export function buildMerchantInput(
  product: Partial<Product>,
): { input: MerchantInput; reason?: never } | { reason: string; input?: never } {
  if (!product.id || !product.published || product._status === 'draft')
    return { reason: 'Продуктът не е публикуван.' }
  if (!isVisibleProduct(product)) return { reason: 'Продуктът не е видим в магазина.' }
  if (!product.slug?.trim() || !product.title?.trim())
    return { reason: 'Липсва име или адрес на продукта.' }
  if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price <= 0)
    return { reason: 'Липсва валидна продажна цена в EUR.' }
  const amountMicros = Math.round(product.price * 1_000_000)
  if (!Number.isSafeInteger(amountMicros)) return { reason: 'Цената е извън допустимия диапазон.' }
  const description = formatLegacyProductDescription(
    product.description || product.shortDescription,
  )
  if (!description) return { reason: 'Липсва описание.' }
  const images = (product.images || []).map(resolveProductImageURL).filter(Boolean)
  const imageLinks = [
    ...new Set(
      images.flatMap((url) => {
        try {
          const parsed = new URL(url, 'https://ibis-electronics.com')
          return parsed.protocol === 'https:' ? [parsed.href] : []
        } catch {
          return []
        }
      }),
    ),
  ]
  if (!imageLinks.length) return { reason: 'Липсва публично HTTPS изображение.' }
  const brand = typeof product.brand === 'object' ? product.brand?.title?.trim() : undefined
  return {
    input: {
      offerId: merchantOfferId(product.id),
      contentLanguage: 'bg',
      feedLabel: 'BG',
      productAttributes: {
        title: product.title.trim().slice(0, 150),
        description: description.slice(0, 5000),
        link: `https://ibis-electronics.com/products/${encodeURIComponent(product.slug)}`,
        imageLink: imageLinks[0],
        ...(imageLinks.length > 1 ? { additionalImageLinks: imageLinks.slice(1, 11) } : {}),
        availability: 'IN_STOCK',
        price: { amountMicros: String(amountMicros), currencyCode: 'EUR' },
        ...(brand ? { brand } : {}),
        ...(product.manufacturerCode?.trim() ? { mpn: product.manufacturerCode.trim() } : {}),
      },
    },
  }
}
