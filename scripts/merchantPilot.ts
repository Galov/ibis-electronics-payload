import type { Product } from '../src/payload-types'
import { MerchantClient } from '../src/merchant/client'
import { buildMerchantInput } from '../src/merchant/productInput'

// Uses only the public BG catalog. No production database credential is required.
// No secret is printed, persisted or copied into the repository.
const send = process.argv.includes('--send')
const statusOnly = process.argv.includes('--status')
const client = new MerchantClient()
if (send || statusOnly) {
  const source = await client.source()
  const primary = source?.primaryProductDataSource as { countries?: string[] } | undefined
  if (source?.input !== 'API' || !primary?.countries?.includes('BG'))
    throw new Error('The selected BG data source is not an API source targeting Romania.')
}
const query = new URLSearchParams({
  depth: '1',
  limit: '20',
  sort: 'id',
  'where[published][equals]': 'true',
  'where[stockQty][greater_than]': '0',
})
const response = await fetch(`https://ibis-electronics.com/api/products?${query}`, {
  signal: AbortSignal.timeout(30_000),
})
if (!response.ok) throw new Error(`Public catalog HTTP ${response.status}`)
const catalog = (await response.json()) as { docs: Product[] }
let count = 0
for (const product of catalog.docs) {
  if (count >= 3) break
  const mapped = buildMerchantInput(product)
  if (!mapped.input) continue
  const input = mapped.input
  if (statusOnly) {
    const result = await client.status(product.id)
    console.log(
      JSON.stringify({
        productId: product.id,
        offerId: input.offerId,
        googleStatus: result?.productStatus || null,
      }),
    )
  } else {
    // Verify the actual public landing page agrees with the proposed price/stock.
    const page = await fetch(input.productAttributes.link, { signal: AbortSignal.timeout(30_000) })
    if (!page.ok || new URL(page.url).hostname !== 'ibis-electronics.com') continue
    const html = await page.text()
    const schemas = [
      ...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ].flatMap((match) => {
      try {
        return [JSON.parse(match[1])]
      } catch {
        return []
      }
    })
    const schema = schemas.find((value) => value['@type'] === 'Product')
    if (
      !schema ||
      schema.offers?.priceCurrency !== 'EUR' ||
      Math.round(Number(schema.offers.price) * 1_000_000) !==
        Number(input.productAttributes.price.amountMicros) ||
      schema.offers.availability !== 'https://schema.org/InStock'
    )
      continue
    const image = await fetch(input.productAttributes.imageLink, {
      method: 'HEAD',
      signal: AbortSignal.timeout(20_000),
    })
    if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) continue
    if (send) await client.insert(input)
    console.log(
      JSON.stringify({
        mode: send ? 'sent' : 'dry-run',
        productId: product.id,
        offerId: input.offerId,
        title: input.productAttributes.title,
        price: input.productAttributes.price,
        link: input.productAttributes.link,
      }),
    )
  }
  count++
}
if (!count) throw new Error('No verified public products available for the pilot.')
