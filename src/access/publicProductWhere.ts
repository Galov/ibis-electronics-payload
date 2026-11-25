import type { Where } from 'payload'

export const publicProductWhere: Where = {
  and: [
    { published: { equals: true } },
    { stockQty: { greater_than: 0 } },
    {
      or: [
        // Positive comparisons can match one array item even when other items omit the field.
        // The MongoDB adapter casts the upload comparison to an ObjectId.
        { 'images.image': { greater_than: '000000000000000000000000' } },
        { 'images.storageKey': { greater_than: '' } },
        { 'images.legacyUrl': { greater_than: '' } },
      ],
    },
  ],
}
