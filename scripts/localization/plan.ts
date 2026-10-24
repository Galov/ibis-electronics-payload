import { isDeepStrictEqual } from 'node:util'

// Raw Mongo Extended JSON is deliberately kept opaque: IDs, dates and numeric
// wrappers are never decoded or passed through Payload hooks.
export type Snapshot = Record<string, Record<string, unknown>[]>
export type Patch = {
  collection: string
  id: unknown
  path: string
  before: string | null
  after: { bg: string | null }
}
export type Plan = { format: 'ibis-bg-en-v1'; patches: Patch[] }
const textPaths = ['title', 'description', 'shortDescription', 'meta.title', 'meta.description']
const targets: Record<string, string[]> = {
  products: textPaths,
  categories: ['title', 'meta.title', 'meta.description'],
  // Logical export keys; physical version collection names must be verified on the clone.
  productVersions: textPaths.map((path) => `version.${path}`),
  categoryVersions: ['title', 'meta.title', 'meta.description'].map((path) => `version.${path}`),
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function read(doc: Record<string, unknown>, path: string): unknown {
  let value: unknown = doc
  for (const key of path.split('.')) {
    if (value === undefined || value === null) return undefined
    if (!record(value)) throw new Error(`Invalid parent at ${path}`)
    value = value[key]
  }
  return value
}

function validateSnapshot(snapshot: Snapshot) {
  if (!record(snapshot)) throw new Error('Expected a snapshot object')
  for (const key of Object.keys(snapshot)) {
    if (!Object.hasOwn(targets, key)) throw new Error(`Unsupported collection: ${key}`)
    const docs = snapshot[key]
    if (!Array.isArray(docs)) throw new Error(`Expected documents: ${key}`)
    const ids = new Set<string>()
    for (const doc of docs) {
      if (!record(doc) || !Object.hasOwn(doc, '_id') || doc._id == null)
        throw new Error(`Missing Mongo _id: ${key}`)
      const id = JSON.stringify(doc._id)
      if (ids.has(id)) throw new Error(`Duplicate _id: ${key}`)
      ids.add(id)
    }
  }
  if (!snapshot.products || !snapshot.categories)
    throw new Error('Both products and categories exports are required')
}

export function planLocalization(snapshot: Snapshot): Plan {
  validateSnapshot(snapshot)
  const patches: Patch[] = []
  for (const [collection, docs] of Object.entries(snapshot)) {
    for (const doc of docs) {
      for (const path of targets[collection]) {
        const value = read(doc, path)
        if (value === undefined) continue
        if (typeof value === 'string' || value === null) {
          patches.push({ collection, id: doc._id, path, before: value, after: { bg: value } })
        } else if (
          !record(value) ||
          !Object.hasOwn(value, 'bg') ||
          Object.keys(value).some((key) => key !== 'bg' && key !== 'en') ||
          Object.values(value).some((text) => text !== null && typeof text !== 'string')
        ) {
          throw new Error(`Unexpected localized value: ${collection}.${path}`)
        }
      }
    }
  }
  return { format: 'ibis-bg-en-v1', patches }
}

// Offline rehearsal only. Every precondition is checked before changing the copy.
// Reverse refuses to erase EN or any text edited since the forward migration.
export function rehearseLocalization(snapshot: Snapshot, plan: Plan, reverse = false): Snapshot {
  validateSnapshot(snapshot)
  if (plan.format !== 'ibis-bg-en-v1' || !Array.isArray(plan.patches))
    throw new Error('Unsupported migration plan')
  const copy: Snapshot = JSON.parse(JSON.stringify(snapshot))
  const seen = new Set<string>()
  for (const patch of plan.patches) {
    if (
      !Object.hasOwn(targets, patch.collection) ||
      !targets[patch.collection].includes(patch.path)
    )
      throw new Error('Unsupported patch path')
    if (
      (patch.before !== null && typeof patch.before !== 'string') ||
      !isDeepStrictEqual(patch.after, { bg: patch.before })
    )
      throw new Error('Invalid patch value')
    const key = JSON.stringify([patch.collection, patch.id, patch.path])
    if (seen.has(key)) throw new Error('Duplicate patch')
    seen.add(key)
    const doc = copy[patch.collection]?.find((item) => isDeepStrictEqual(item._id, patch.id))
    if (!doc || !isDeepStrictEqual(read(doc, patch.path), reverse ? patch.after : patch.before))
      throw new Error(`Migration conflict: ${patch.collection}.${patch.path}`)
  }
  for (const patch of plan.patches) {
    const doc = copy[patch.collection].find((item) => isDeepStrictEqual(item._id, patch.id))!
    const keys = patch.path.split('.')
    let parent = doc
    for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>
    parent[keys.at(-1)!] = reverse ? patch.before : structuredClone(patch.after)
  }
  return copy
}
