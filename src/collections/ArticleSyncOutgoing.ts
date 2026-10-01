import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const ArticleSyncOutgoing: CollectionConfig = {
  slug: 'article-sync-outgoing',
  labels: { singular: 'Изпращане на статия към РО', plural: 'Изпращания на статии към РО' },
  admin: {
    group: 'Интеграции',
    useAsTitle: 'sourceArticleId',
    defaultColumns: ['sourceArticleId', 'revision', 'status', 'updatedAt'],
  },
  access: { read: adminOnly, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'sourceArticleId', label: 'БГ статия', type: 'text', required: true, unique: true },
    { name: 'revision', label: 'Изпратена версия', type: 'number', required: true },
    { name: 'eventId', label: 'Събитие', type: 'text', required: true },
    { name: 'payload', type: 'json', required: true, admin: { hidden: true } },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      required: true,
      options: [
        { label: 'Изпраща се', value: 'sending' },
        { label: 'Чака превод', value: 'queued' },
        { label: 'Превежда се', value: 'translating' },
        { label: 'РО черновата е готова', value: 'succeeded' },
        { label: 'Заменено от по-нова версия', value: 'superseded' },
        { label: 'Грешка', value: 'failed' },
        { label: 'Резултатът не е потвърден', value: 'unknown' },
      ],
    },
    { name: 'error', label: 'Грешка', type: 'textarea' },
    { name: 'warnings', label: 'За преглед в РО', type: 'json' },
    { name: 'postId', label: 'РО статия', type: 'text' },
  ],
}
