import { formatLegacyProductDescription } from '../../src/utilities/formatLegacyProductDescription'

export const imageBase = 'https://pub-622233fdc4f2482dbbcdc30b088f61ab.r2.dev'
export const placeholder = '/assets/no-image.svg'
export const pageSize = 60
export type ReviewProduct = {
  id: string
  title: string
  description: string
  summary: string
  seoTitle: string
  seoDescription: string
  sku: string
  originalSku: string
  manufacturerCode: string
  brand: string
  categories: string[]
  images: string[]
  price: number | null
}
export type ReviewCategory = { id: string; title: string; count: number }
export const categoryNames: Record<string, string> = {
  Продукти: 'Other products',
  Перални: 'Washing machines',
  Съдомиялни: 'Dishwashers',
  'Готварски печки': 'Cookers and ovens',
  Бойлери: 'Water heaters',
  Сушилни: 'Tumble dryers',
  Прахосмукачки: 'Vacuum cleaners',
  'Микровълнови фурни': 'Microwave ovens',
  'Отоплителни уреди': 'Heating appliances',
  'Термостати и Термозащити': 'Thermostats and thermal protection',
  Хладилници: 'Refrigerators',
  'Електро-инструменти': 'Power tools',
  Кафемашини: 'Coffee machines',
  Лагери: 'Bearings',
  Диспенсъри: 'Dispensers',
  'Уреди на газ': 'Gas appliances',
  'Ютии и парогенератори': 'Irons and steam generators',
  'Професионални уреди': 'Professional appliances',
  Кафеварки: 'Coffee makers',
  Котли: 'Boilers',
  'Без категория': 'Other products',
  Фритюрници: 'Fryers',
  Минифурни: 'Mini ovens',
  'Ключове и Бутони': 'Switches and buttons',
  'Тенджери под налягане': 'Pressure cookers',
  Хлебопекарни: 'Bread makers',
  'Малки домакински уреди': 'Small household appliances',
  Водопровод: 'Plumbing',
  'Сешоари професионални': 'Professional hair dryers',
  'Кабелни обувки': 'Cable terminals',
  Скоби: 'Clamps',
  Сауна: 'Sauna heaters',
  Аспиратори: 'Cooker hoods',
  КЛИМАТИЦИ: 'Air conditioners',
  Електроматериали: 'Electrical supplies',
  'Термостати Кликсон': 'Thermal switches',
  Аксесоари: 'Accessories',
  'Кафемашини и аксесоари "Sage"': 'Sage coffee machines and accessories',
  'ПРЕОЦЕНЕНИ ХЕПА ФИЛТРИ': 'Discounted HEPA filters',
  'Вентилатори за баня': 'Bathroom fans',
  Микрети: 'Microswitches',
  'Дребни електроуреди за бита': 'Small household appliances',
  Месомелачки: 'Meat grinders',
  Скари: 'Grills',
  Кондензатори: 'Capacitors',
  Предпазители: 'Fuses',
  'Електроуреди Tesy': 'Tesy appliances',
}
export function escapeHTML(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
export function englishText(value: unknown): string {
  const raw = value && typeof value === 'object' ? (value as { en?: unknown }).en : null
  if (typeof raw !== 'string') return ''
  return formatLegacyProductDescription(raw).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, s: string) => {
    const n = s[0].toLowerCase() === 'x' ? parseInt(s.slice(1), 16) : Number(s)
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
  })
}
export function imageURL(
  row: any,
  media: Map<string, { filename?: string; url?: string }>,
): string {
  const m = media.get(String(row?.image || ''))
  if (m?.filename) return `${imageBase}/${encodeURIComponent(m.filename)}`
  if (
    typeof row?.storageKey === 'string' &&
    row.storageKey &&
    !row.storageKey.split('/').includes('..')
  )
    return `${imageBase}/${row.storageKey.split('/').map(encodeURIComponent).join('/')}`
  const raw = m?.url || row?.legacyUrl
  try {
    const u = new URL(raw)
    if (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      [new URL(imageBase).hostname, 'ibis-electronics.com', 'www.ibis-electronics.com'].includes(
        u.hostname,
      )
    )
      return u.href
  } catch {
    /* No safe public image. */
  }
  return ''
}
export function rootCategories(ids: unknown[], categories: Map<string, any>): string[] {
  const roots = new Set<string>()
  for (const id of ids) {
    let c = categories.get(String(id))
    const seen = new Set<string>()
    while (c?.parent && !seen.has(String(c._id))) {
      seen.add(String(c._id))
      const parent = categories.get(String(c.parent))
      if (!parent) break
      c = parent
    }
    if (c && categoryNames[c.title]) roots.add(String(c._id))
  }
  return [...roots]
}
export function reviewProduct(
  doc: any,
  media: Map<string, any>,
  categories: Map<string, any>,
  brands: Map<string, string>,
): ReviewProduct | null {
  const title = englishText(doc.title)
  if (!title || !/^[a-f0-9]{24}$/.test(String(doc._id))) return null
  const brand = brands.get(String(doc.brand)) || ''
  return {
    id: String(doc._id),
    title,
    description: englishText(doc.description),
    summary: englishText(doc.shortDescription),
    seoTitle: englishText(doc.meta?.title),
    seoDescription: englishText(doc.meta?.description),
    sku: typeof doc.sku === 'string' ? doc.sku : '',
    originalSku: typeof doc.originalSku === 'string' ? doc.originalSku : '',
    manufacturerCode: typeof doc.manufacturerCode === 'string' ? doc.manufacturerCode : '',
    brand: /[\u0400-\u04ff]/.test(brand) ? '' : brand,
    categories: rootCategories(doc.categories || [], categories),
    images: [
      ...new Set<string>((doc.images || []).map((i: any) => imageURL(i, media)).filter(Boolean)),
    ].slice(0, 8),
    price:
      typeof doc.price === 'number' && Number.isFinite(doc.price) && doc.price > 0
        ? doc.price
        : null,
  }
}
export const productPath = (p: Pick<ReviewProduct, 'id'>) => `/en/products/${p.id}/`
export const cataloguePath = (page = 1) => (page === 1 ? '/en/' : `/en/page/${page}/`)
export function shell(title: string, body: string, stamp: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex"><meta name="referrer" content="no-referrer"><title>${escapeHTML(title)} · Ibis product review</title><link rel="stylesheet" href="/assets/review.css"><script src="/assets/review.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><div class="review-strip">IBIS INTERNAL REVIEW <span>English product translations · browsing only</span></div><header class="header"><a href="/en/" aria-label="Ibis Electronics product catalogue"><img class="logo" src="/assets/ibis-logo.png" alt="Ibis Electronics" width="216" height="58"></a><a class="catalogue-link" href="/en/">Product catalogue <span aria-hidden="true">↗</span></a></header>${body}<footer><span>Ibis Electronics · English product review</span><span>Local data snapshot · ${escapeHTML(stamp)}</span></footer></body></html>`
}
export function productCard(p: ReviewProduct): string {
  return `<article class="product-card"><a href="${productPath(p)}"><div class="card-image"><img src="${escapeHTML(p.images[0] || placeholder)}" alt="${escapeHTML(p.title)}" loading="lazy" width="260" height="215"></div><p class="sku">${escapeHTML(p.sku || 'Part reference unavailable')}</p><h2>${escapeHTML(p.title)}</h2><span class="view-product">View product <span aria-hidden="true">→</span></span></a></article>`
}
export function catalogueHTML(
  products: ReviewProduct[],
  categories: ReviewCategory[],
  page: number,
  stamp: string,
): string {
  const pages = Math.ceil(products.length / pageSize),
    slice = products.slice((page - 1) * pageSize, page * pageSize)
  const nav = `<nav class="pagination" aria-label="Catalogue pages">${page > 1 ? `<a href="${cataloguePath(page - 1)}">← Previous</a>` : '<span></span>'}<span>Page ${page} of ${pages}</span>${page < pages ? `<a href="${cataloguePath(page + 1)}">Next →</a>` : '<span></span>'}</nav>`
  return shell(
    'English catalogue',
    `<main id="main" class="catalogue"><div class="heading"><div><p class="eyebrow">PRODUCT TRANSLATION REVIEW</p><h1>English catalogue<span>.</span></h1></div><p class="catalogue-note">${products.length.toLocaleString('en')} products<br><span>Review names, descriptions and part references.</span></p></div><div class="tools" id="catalogue-tools"><div class="search"><label for="search">Search products</label><input id="search" type="search" placeholder="Product name, brand or part number" autocomplete="off"></div><div class="category-filter"><label for="category">Appliance category</label><select id="category"><option value="">All categories</option>${categories.map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.title)} (${c.count})</option>`).join('')}</select></div><button type="button" class="reset" id="reset">Clear filters</button></div><p class="results" id="result-count" role="status" aria-live="polite">${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, products.length)} of ${products.length.toLocaleString('en')} products</p><div class="product-grid" id="products">${slice.map(productCard).join('')}</div><div id="pagination">${nav}</div><p id="search-error" class="search-error" hidden>Search could not load. You can still browse the catalogue pages.</p><noscript><p>Search needs JavaScript. All products are available through the catalogue pages below.</p></noscript></main>`,
    stamp,
  )
}
export function productHTML(
  p: ReviewProduct,
  categories: Map<string, ReviewCategory>,
  stamp: string,
): string {
  const photos = p.images.length ? p.images : [placeholder]
  const row = (label: string, text: string) =>
    text ? `<div><dt>${label}</dt><dd>${escapeHTML(text)}</dd></div>` : ''
  return shell(
    p.title,
    `<main id="main" class="product-page"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/en/">English catalogue</a><span aria-hidden="true">/</span><span>${escapeHTML(p.sku || 'Product')}</span></nav><div class="product-layout"><section class="gallery" aria-label="Product images"><div class="main-image"><img id="main-image" src="${escapeHTML(photos[0])}" alt="${escapeHTML(p.title)}" width="640" height="560" fetchpriority="high"></div>${photos.length > 1 ? `<div class="thumbnails">${photos.map((url, i) => `<button type="button" data-photo="${escapeHTML(url)}" aria-label="View image ${i + 1}" aria-pressed="${i === 0}"><img src="${escapeHTML(url)}" alt="" loading="lazy" width="75" height="75"></button>`).join('')}</div>` : ''}</section><article class="product-info"><p class="eyebrow">ENGLISH PRODUCT PREVIEW</p><h1>${escapeHTML(p.title)}</h1><dl class="references">${row('Part number', p.sku)}${row('Original code', p.originalSku)}${row('Manufacturer reference', p.manufacturerCode)}${row('Brand', p.brand)}${row(
      'Category',
      p.categories
        .map((id) => categories.get(id)?.title)
        .filter(Boolean)
        .join(' · '),
    )}</dl>${p.summary ? `<section class="description"><h2>Short description</h2><div>${escapeHTML(p.summary)}</div></section>` : ''}<section class="description"><h2>Product description</h2><div>${escapeHTML(p.description || 'No description is supplied for this product.')}</div></section>${p.price !== null ? `<p class="reference-price">Reference price from the snapshot <strong>${new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(p.price)}</strong></p>` : ''}<details class="seo"><summary>Search engine text</summary><h3>SEO title</h3><p>${escapeHTML(p.seoTitle || 'No separate SEO title.')}</p><h3>SEO description</h3><p>${escapeHTML(p.seoDescription || 'No separate SEO description.')}</p></details><p class="review-only">For translation review only. Orders cannot be placed in this preview.</p></article></div></main>`,
    stamp,
  )
}
