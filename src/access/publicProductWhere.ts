import type { Where } from 'payload'

export const publicProductWhere: Where = {
  and: [
    { published: { equals: true } },
    { stockQty: { greater_than: 0 } },
    {
      or: [
        { 'images.image': { exists: true } },
        { 'images.storageKey': { exists: true } },
        { 'images.legacyUrl': { exists: true } },
      ],
    },
  ],
}
