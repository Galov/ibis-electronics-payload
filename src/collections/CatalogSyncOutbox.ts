import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { checkRole } from '@/access/utilities'

export const CatalogSyncOutbox: CollectionConfig = {
  slug: 'catalog-sync-outbox',
  access: {
    admin: ({ req: { user } }) => Boolean(user && checkRole(['admin'], user)),
    create: () => false,
    delete: () => false,
    read: adminOnly,
    update: () => false,
  },
  admin: {
    defaultColumns: ['product', 'action', 'status', 'attempts', 'nextAttemptAt', 'updatedAt'],
    description: 'Устойчива опашка за синхронизация към румънския каталог.',
    group: 'Интеграции',
    useAsTitle: 'dedupeKey',
  },
  labels: {
    plural: 'Синхронизации към Румъния',
    singular: 'Синхронизация към Румъния',
  },
  fields: [
    {
      name: 'product',
      label: 'Български продукт',
      type: 'relationship',
      index: true,
      relationTo: 'products',
      required: true,
    },
    {
      name: 'action',
      label: 'Действие',
      type: 'select',
      index: true,
      options: [
        { label: 'Първоначално изпращане', value: 'initial' },
        { label: 'Промяна на съдържание', value: 'content' },
        { label: 'Търговска промяна', value: 'commerce' },
      ],
      required: true,
    },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Чака', value: 'pending' },
        { label: 'Изпраща се', value: 'sending' },
        { label: 'Прието от Румъния', value: 'accepted' },
        { label: 'Чака повторен опит', value: 'retry_wait' },
        { label: 'Успешно', value: 'succeeded' },
        { label: 'Постоянна грешка', value: 'failed' },
        { label: 'Блокирано от договора', value: 'blocked_contract' },
      ],
      required: true,
    },
    {
      name: 'dedupeKey',
      label: 'Ключ за идемпотентност',
      type: 'text',
      index: true,
      required: true,
      unique: true,
    },
    { name: 'eventId', label: 'Event ID', type: 'text', index: true },
    { name: 'contentFingerprint', label: 'Content fingerprint', type: 'text', required: true },
    { name: 'commerceFingerprint', label: 'Commerce fingerprint', type: 'text', required: true },
    { name: 'eventPayload', label: 'Catalog Sync event', type: 'json', admin: { hidden: true } },
    {
      name: 'commerceSnapshot',
      label: 'Търговски snapshot',
      type: 'json',
      admin: { hidden: true },
    },
    { name: 'attempts', label: 'Опити', type: 'number', defaultValue: 0, required: true },
    { name: 'nextAttemptAt', label: 'Следващ опит', type: 'date', index: true },
    { name: 'leaseExpiresAt', label: 'Lease до', type: 'date', index: true },
    { name: 'lastError', label: 'Последна грешка', type: 'textarea' },
    { name: 'acceptedAt', label: 'Прието на', type: 'date' },
    { name: 'completedAt', label: 'Приключено на', type: 'date' },
  ],
  timestamps: true,
}
