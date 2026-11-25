// Route metadata only: never changes BG text, the shared slug, SKU or commerce fields.
export const englishRouteFields = ['englishSlug', 'englishLegacySlug']
export const englishSlugBase = (title) =>
  String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/&/g, '-and-')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
    .replace(/-+$/g, '') || 'product'
export const hasEnglishTitle = (doc) => typeof doc.title?.en === 'string' && !!doc.title.en.trim()
const id = (doc) => String(doc._id)
const valid = (value) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
const candidateAt = (base, productId, attempt) =>
  attempt === 0 ? base : `${base}-${productId}${attempt === 1 ? '' : `-${attempt}`}`

export function planEnglishSlugBackfill(docs) {
  const reserved = new Map()
  const reserve = (slug, owner) => {
    if (typeof slug !== 'string' || !slug) return
    const owners = reserved.get(slug) || new Set()
    owners.add(owner)
    reserved.set(slug, owners)
  }
  const available = (slug, owner) =>
    !reserved.has(slug) || [...reserved.get(slug)].every((value) => value === owner)
  for (const doc of docs)
    for (const key of ['slug', ...englishRouteFields]) reserve(doc[key], id(doc))
  const rows = []
  for (const doc of [...docs].sort((a, b) => id(a).localeCompare(id(b)))) {
    if (doc.englishSlug) {
      if (!valid(doc.englishSlug)) throw Error('Unexpected existing English slug')
      continue
    }
    if (!hasEnglishTitle(doc)) continue
    const owner = id(doc),
      base = englishSlugBase(doc.title.en)
    if (!/^[a-f0-9]{24}$/.test(owner)) throw Error('Invalid product ID')
    let englishSlug
    for (let attempt = 0; attempt < 1000; attempt++) {
      const candidate = candidateAt(base, owner, attempt)
      if (available(candidate, owner)) {
        englishSlug = candidate
        break
      }
    }
    if (!englishSlug) throw Error('English slug namespace exhausted')
    /** @type {{englishSlug: string, englishLegacySlug?: string}} */
    const patch = { englishSlug }
    if (
      !doc.englishLegacySlug &&
      typeof doc.slug === 'string' &&
      doc.slug &&
      available(doc.slug, owner)
    )
      patch.englishLegacySlug = doc.slug
    reserve(englishSlug, owner)
    if (patch.englishLegacySlug) reserve(patch.englishLegacySlug, owner)
    rows.push({ id: owner, title: doc.title.en, slug: doc.slug, patch })
  }
  return rows
}

export async function planEnglishSlugPatch(products, doc, title, session) {
  if (doc.englishSlug || typeof title !== 'string' || !title.trim()) return {}
  const base = englishSlugBase(title),
    owner = id(doc)
  if (!/^[a-f0-9]{24}$/.test(owner)) throw Error('Invalid product ID')
  const occupied = async (slug) =>
    products.findOne(
      {
        _id: { $ne: doc._id },
        $or: [{ slug }, { englishSlug: slug }, { englishLegacySlug: slug }],
      },
      { session, projection: { _id: 1 } },
    )
  let englishSlug
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = candidateAt(base, owner, attempt)
    if (!(await occupied(candidate))) {
      englishSlug = candidate
      break
    }
  }
  if (!englishSlug) throw Error('English slug namespace exhausted')
  /** @type {{englishSlug: string, englishLegacySlug?: string}} */
  const patch = { englishSlug }
  if (
    !doc.englishLegacySlug &&
    typeof doc.slug === 'string' &&
    doc.slug &&
    !(await occupied(doc.slug))
  )
    patch.englishLegacySlug = doc.slug
  return patch
}

export async function ensureEnglishSlugIndexes(products) {
  for (const field of englishRouteFields)
    await products.createIndex(
      { [field]: 1 },
      {
        name: `ibis_${field}_unique`,
        unique: true,
        partialFilterExpression: { [field]: { $type: 'string' } },
      },
    )
}

export async function assignEnglishProductSlug(products, client, productId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const session = client.startSession()
    try {
      let status = 'missing'
      await session.withTransaction(
        async () => {
          const doc = await products.findOne({ _id: productId }, { session })
          if (!doc) {
            status = 'deleted'
            return
          }
          if (doc.englishSlug) {
            status = 'already_ready'
            return
          }
          if (!hasEnglishTitle(doc)) {
            status = 'no_english_title'
            return
          }
          const patch = await planEnglishSlugPatch(products, doc, doc.title.en, session)
          const result = await products.updateOne({ _id: doc._id }, { $set: patch }, { session })
          if (result.matchedCount !== 1) throw Error('Product changed during route assignment')
          status = 'assigned'
        },
        { writeConcern: { w: 'majority', j: true } },
      )
      return status
    } catch (error) {
      if (error.code !== 11000 || attempt === 9) throw error
    } finally {
      await session.endSession()
    }
  }
  throw Error('English slug assignment retries exhausted')
}
