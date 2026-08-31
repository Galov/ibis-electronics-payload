import type { CollectionConfig } from 'payload'

const denyAccess = () => false

export const CatalogSyncBatchRuns: CollectionConfig = {
  slug: 'catalog-sync-batch-runs',
  access: {
    admin: denyAccess,
    create: denyAccess,
    delete: denyAccess,
    read: denyAccess,
    update: denyAccess,
  },
  admin: {
    hidden: true,
  },
  fields: [
    {
      name: 'mode',
      type: 'select',
      index: true,
      options: ['send', 'retry-failed'],
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      index: true,
      options: ['running', 'completed'],
      required: true,
    },
    {
      name: 'completionReason',
      type: 'select',
      options: ['exhausted', 'limit_reached'],
    },
    { name: 'limit', type: 'number', required: true },
    { name: 'timeoutMs', type: 'number', required: true },
    { name: 'pollIntervalMs', type: 'number', required: true },
    { name: 'nextIndex', type: 'number', defaultValue: 0, required: true },
    { name: 'sentCount', type: 'number', defaultValue: 0, required: true },
    { name: 'succeededCount', type: 'number', defaultValue: 0, required: true },
    { name: 'failedCount', type: 'number', defaultValue: 0, required: true },
    { name: 'invalidCount', type: 'number', defaultValue: 0, required: true },
    { name: 'skippedCurrentCount', type: 'number', defaultValue: 0, required: true },
    { name: 'snapshot', type: 'json', required: true },
    { name: 'results', type: 'json', required: true },
    { name: 'activeProductId', type: 'text' },
    { name: 'activeEventId', type: 'text' },
    { name: 'activeCounted', type: 'checkbox', defaultValue: false, required: true },
    { name: 'startedAt', type: 'date', required: true },
    { name: 'completedAt', type: 'date' },
  ],
  timestamps: true,
}
