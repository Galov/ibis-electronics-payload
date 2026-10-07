import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const MerchantSyncEntries: CollectionConfig = {
  slug: 'merchant-sync-entries',
  labels: { singular: 'Merchant синхронизация', plural: 'Merchant синхронизации' },
  admin: {
    group: 'Интеграции',
    useAsTitle: 'productId',
    defaultColumns: ['productId', 'status', 'lastSentAt', 'error'],
  },
  access: { read: adminOnly, create: () => false, update: () => false, delete: () => false },
  fields: [
    {
      name: 'productId',
      label: 'ID на продукта',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'status',
      label: 'Синхронизация (не одобрение от Google)',
      type: 'select',
      required: true,
      options: [
        { label: 'Изпратен', value: 'sent' },
        { label: 'Премахнат', value: 'removed' },
        { label: 'Пропуснат', value: 'skipped' },
        { label: 'Грешка', value: 'failed' },
      ],
    },
    { name: 'inputHash', type: 'text', admin: { hidden: true } },
    { name: 'lastSentAt', label: 'Последно изпращане', type: 'date' },
    { name: 'lastCheckedAt', label: 'Последна проверка', type: 'date' },
    { name: 'reason', label: 'Причина за пропускане', type: 'textarea' },
    { name: 'error', label: 'Грешка', type: 'textarea' },
    { name: 'googleStatus', label: 'Статус и проблеми от Google', type: 'json' },
  ],
}
