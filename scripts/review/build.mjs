// Read-only export from the isolated local database. Never loads .env or Payload.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import {
  localTranslationURI,
  assertLocalTranslationURI,
  sourceText,
  sourceFingerprint,
  missingEnglishFields,
} from '../localization/translationCore.ts'
import {
  reviewProduct,
  categoryNames,
  catalogueHTML,
  productHTML,
  productPath,
  cataloguePath,
  pageSize,
  imageBase,
} from './catalog.ts'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const output = path.join(root, '.local-notes/english-products-review/site')
export const productProjection = {
  _id: 1,
  title: 1,
  description: 1,
  shortDescription: 1,
  'meta.title': 1,
  'meta.description': 1,
  sku: 1,
  originalSku: 1,
  manufacturerCode: 1,
  brand: 1,
  categories: 1,
  images: 1,
  price: 1,
}
export async function buildReview(argv = process.argv.slice(2)) {
  if (argv.length)
    throw new Error('Usage: npm run review:products:build (no database or output overrides)')
  assertLocalTranslationURI(localTranslationURI)
  globalThis.fetch = () =>
    Promise.reject(new Error('Network fetch is disabled during static export'))
  const require = createRequire(import.meta.url)
  const { MongoClient } = require(
    require.resolve('mongodb', {
      paths: [path.dirname(require.resolve('@payloadcms/db-mongodb'))],
    }),
  )
  const client = new MongoClient(localTranslationURI, { readConcern: { level: 'majority' } })
  let staging
  try {
    await client.connect()
    const db = client.db('ibis_bg_en_test')
    const [jobs, categories, brands, media, states] = await Promise.all([
      db
        .collection('local_translation_jobs')
        .find(
          { status: { $in: ['completed', 'skipped_existing'] } },
          { projection: { productId: 1, fingerprint: 1 } },
        )
        .toArray(),
      db
        .collection('categories')
        .find({}, { projection: { title: 1, parent: 1 } })
        .toArray(),
      db
        .collection('brands')
        .find({}, { projection: { title: 1 } })
        .toArray(),
      db
        .collection('media')
        .find({}, { projection: { filename: 1, url: 1 } })
        .toArray(),
      db
        .collection('local_translation_jobs')
        .aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
        .toArray(),
    ])
    const ready = new Map()
    for (const j of jobs) {
      const id = String(j.productId)
      if (!ready.has(id)) ready.set(id, new Set())
      ready.get(id).add(j.fingerprint)
    }
    const catMap = new Map(categories.map((c) => [String(c._id), c])),
      brandMap = new Map(brands.map((b) => [String(b._id), b.title])),
      mediaMap = new Map(media.map((m) => [String(m._id), m]))
    const products = []
    let stale = 0,
      incomplete = 0
    for await (const doc of db.collection('products').find({}, { projection: productProjection })) {
      const fingerprints = ready.get(String(doc._id))
      if (!fingerprints) continue
      let source
      try {
        source = sourceText(doc)
      } catch {
        incomplete++
        continue
      }
      if (!fingerprints.has(sourceFingerprint(source))) {
        stale++
        continue
      }
      if (missingEnglishFields(doc, source).length) {
        incomplete++
        continue
      }
      const product = reviewProduct(doc, mediaMap, catMap, brandMap)
      if (product) products.push(product)
      else incomplete++
    }
    if (!products.length)
      throw new Error('No completed English products; existing preview was not replaced')
    products.sort((a, b) => a.title.localeCompare(b.title, 'en') || a.id.localeCompare(b.id))
    const groupMap = new Map()
    for (const p of products) {
      p.categories = [
        ...new Set(
          p.categories.map((id) => categoryNames[catMap.get(id)?.title] || 'Other products'),
        ),
      ]
      if (!p.categories.length) p.categories = ['Other products']
      p.categories = p.categories.map((title) => {
        const id = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        if (!groupMap.has(id)) groupMap.set(id, { id, title, count: 0 })
        groupMap.get(id).count++
        return id
      })
    }
    const groups = [...groupMap.values()].sort((a, b) => a.title.localeCompare(b.title, 'en'))
    const groupById = new Map(groups.map((c) => [c.id, c]))
    const now = new Date(),
      stamp = now.toISOString().slice(0, 10)
    const base = path.dirname(output)
    await fs.mkdir(base, { recursive: true, mode: 0o700 })
    if ((await fs.lstat(output).catch(() => null))?.isSymbolicLink())
      throw new Error('Refusing to replace a symlink')
    staging = await fs.mkdtemp(path.join(base, 'site-building-'))
    const write = async (relative, content) => {
      const target = path.join(staging, relative)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, content)
    }
    await fs.mkdir(path.join(staging, 'assets'))
    for (const name of ['review.css', 'review.js', 'no-image.svg'])
      await fs.copyFile(
        path.join(root, 'scripts/review/assets', name),
        path.join(staging, 'assets', name),
      )
    await fs.copyFile(
      path.join(root, 'public/ibis_blue_logo.png'),
      path.join(staging, 'assets/ibis-logo.png'),
    )
    const pages = Math.ceil(products.length / pageSize)
    for (let page = 1; page <= pages; page++)
      await write(
        cataloguePath(page).slice(1) + 'index.html',
        catalogueHTML(products, groups, page, stamp),
      )
    await write('index.html', catalogueHTML(products, groups, 1, stamp))
    // Limit filesystem concurrency: no build-time image requests or service calls.
    for (let i = 0; i < products.length; i += 40)
      await Promise.all(
        products
          .slice(i, i + 40)
          .map((p) =>
            write(productPath(p).slice(1) + 'index.html', productHTML(p, groupById, stamp)),
          ),
      )
    const index = products.map((p) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      originalSku: p.originalSku,
      manufacturerCode: p.manufacturerCode,
      brand: p.brand,
      categories: p.categories,
      image: p.images[0] || '',
      path: productPath(p),
    }))
    await write('assets/catalogue.json', JSON.stringify(index))
    await write('robots.txt', 'User-agent: *\nDisallow: /\n')
    const csp = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' ${imageBase} https://ibis-electronics.com https://www.ibis-electronics.com; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    await write(
      '_headers',
      `/*\n  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Cache-Control: private, no-store\n  Content-Security-Policy: ${csp}\n`,
    )
    const manifest = {
      format: 'ibis-english-review-v1',
      generatedAt: now.toISOString(),
      products: products.length,
      cataloguePages: pages,
      categories: groups.length,
      productsWithoutImages: products.filter((p) => !p.images.length).length,
      heldForReview: states.find((s) => s._id === 'needs_review')?.n || 0,
      invalidSource: states.find((s) => s._id === 'invalid_source')?.n || 0,
      staleSkipped: stale,
      incompleteSkipped: incomplete,
      contentHash: createHash('sha256').update(JSON.stringify(products)).digest('hex'),
      sampleProducts: index
        .filter((p) => ['312AC17', '111LG108', '304CU10', 'BWF100'].includes(p.sku))
        .map((p) => ({ title: p.title, sku: p.sku, path: p.path })),
      access:
        'Local preview only. Hosting-level password protection is required before any future publication.',
    }
    await write('review-manifest.json', JSON.stringify(manifest, null, 2) + '\n')
    await fs.rm(output, { recursive: true, force: true })
    await fs.rename(staging, output)
    staging = null
    console.log(JSON.stringify({ output, ...manifest }, null, 2))
  } finally {
    await client.close()
    if (staging) await fs.rm(staging, { recursive: true, force: true })
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  buildReview().catch((e) => {
    console.error('Local review export stopped:', e.message)
    process.exitCode = 1
  })
