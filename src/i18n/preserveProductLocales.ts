import type { CollectionBeforeValidateHook, FieldHook, PayloadRequest } from 'payload'

const paths = ['title', 'description', 'shortDescription', 'meta.title', 'meta.description']
const current = new WeakMap<PayloadRequest, Map<string, Promise<Record<string, any> | null>>>()
const read = (doc: any, path: string) => path.split('.').reduce((value, key) => value?.[key], doc)
const hasInput = (doc: any, path: string) => {
  for (const key of path.split('.')) {
    if (doc === null) return true
    if (!doc || !Object.hasOwn(doc, key)) return false
    doc = doc[key]
  }
  return true
}
function load(req: PayloadRequest, id: string, refresh = false) {
  let cache = current.get(req)
  if (!cache) { cache = new Map(); current.set(req, cache) }
  if (refresh || !cache.has(id)) cache.set(id, req.payload.db.findOne({
    collection: 'products', where: { id: { equals: id } }, req,
  }))
  return cache.get(id)!
}

// Payload drafts may predate an external text-only translation. Always preserve
// the current product's other locale instead of restoring stale version content.
export const preserveProductLocaleInput: CollectionBeforeValidateHook = async ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update' || !originalDoc?.id || !['bg', 'en'].includes(req.locale || '')) return data
  const doc = await load(req, String(originalDoc.id), true)
  if (!doc || !data) return data
  for (const path of paths) {
    if (hasInput(data, path)) continue
    const value = read(doc, path)?.[req.locale!]
    if (value === undefined) continue
    const parts = path.split('.'), leaf = parts.pop()!
    let parent = data
    for (const part of parts) parent = parent[part] ||= {}
    parent[leaf] = value
  }
  return data
}

export const preserveOtherProductLocale: FieldHook = async ({ operation, originalDoc, req, siblingDocWithLocales, field, path, value }) => {
  if (operation !== 'update' || !originalDoc?.id || !['bg', 'en'].includes(req.locale || '') || !('name' in field) || !field.name) return value
  const doc = await load(req, String(originalDoc.id))
  if (!doc || !siblingDocWithLocales) return value
  const stored = read(doc, path.join('.'))
  const other = req.locale === 'bg' ? 'en' : 'bg'
  const merged: Record<string, unknown> = { ...(siblingDocWithLocales[field.name] || {}) }
  if (stored && Object.hasOwn(stored, other)) merged[other] = stored[other]
  else delete merged[other]
  siblingDocWithLocales[field.name] = merged
  return value
}
