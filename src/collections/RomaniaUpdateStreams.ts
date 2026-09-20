import type { CollectionConfig } from 'payload'

const deny = () => false

// Each lane retains its latest absolute value and a monotonic revision. There is no runner.
export const RomaniaUpdateStreams: CollectionConfig = {
  slug: 'romania-update-streams',
  admin: { hidden: true },
  access: { admin: deny, read: deny, create: deny, update: deny, delete: deny },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'sourceProductId', type: 'text', required: true, index: true },
    { name: 'kind', type: 'select', required: true, options: ['price', 'stock'] },
    { name: 'revision', type: 'number', required: true, min: 1 },
    { name: 'eventId', type: 'text', required: true, index: true },
    { name: 'event', type: 'json', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: ['pending', 'accepted', 'succeeded', 'superseded', 'failed'],
    },
    { name: 'lastAttemptedAt', type: 'date' },
    { name: 'lastConfirmedAt', type: 'date' },
    { name: 'lastErrorCode', type: 'text' },
    { name: 'lastErrorAt', type: 'date' },
  ],
  timestamps: true,
}
