import type { Field } from 'payload'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'

export const nikOrderFields: Field[] = [
  {
    name: 'nikOrder',
    type: 'group',
    label: 'Поръчка към НИК',
    access: { create: () => false, update: () => false, read: adminOnlyFieldAccess },
    fields: [
      {
        name: 'status',
        type: 'select',
        label: 'Статус към НИК',
        index: true,
        options: [
          { value: 'pending', label: 'Чака изпращане' },
          { value: 'sending', label: 'Изпраща се' },
          { value: 'accepted', label: 'Приета в НИК' },
          { value: 'manual_review', label: 'Необходима ръчна обработка' },
          { value: 'retryable', label: 'Необходимо повторно изпращане' },
          { value: 'unknown', label: 'Непотвърден резултат — повтори същата заявка' },
        ],
        admin: { readOnly: true },
      },
      {
        name: 'request',
        type: 'json',
        label: 'Запазена заявка (SKU и количества)',
        admin: { readOnly: true },
      },
      {
        name: 'remoteOrderId',
        type: 'text',
        label: 'Номер на поръчката в НИК',
        admin: { readOnly: true },
      },
      { name: 'lastCode', type: 'text', label: 'Резултат / грешка', admin: { readOnly: true } },
      { name: 'details', type: 'json', label: 'Артикули за проверка', admin: { readOnly: true } },
      { name: 'lastAttemptAt', type: 'date', label: 'Последен опит', admin: { readOnly: true } },
      { name: 'acceptedAt', type: 'date', label: 'Приета на', admin: { readOnly: true } },
      {
        name: 'microinvestStatus',
        type: 'text',
        label: 'НИК → Микроинвест',
        admin: { readOnly: true },
      },
      {
        name: 'stockSyncStatus',
        type: 'text',
        label: 'НИК → BG наличности',
        admin: { readOnly: true },
      },
      { name: 'attemptId', type: 'text', admin: { hidden: true } },
      { name: 'retryBy', type: 'text', label: 'Последен ръчен опит от', admin: { readOnly: true } },
      {
        name: 'retryReason',
        type: 'textarea',
        label: 'Основание за ръчния опит',
        admin: { readOnly: true },
      },
      {
        name: 'actions',
        type: 'ui',
        admin: { components: { Field: '@/components/admin/NikOrderActions#NikOrderActions' } },
      },
    ],
  },
]
