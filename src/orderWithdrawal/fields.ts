import type { Field } from 'payload'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'

export const withdrawalFields: Field[] = [
  {
    name: 'withdrawal',
    type: 'group',
    label: 'Отказ от поръчката',
    access: { create: () => false, update: adminOnlyFieldAccess },
    fields: [
      {
        name: 'requestedAt',
        type: 'date',
        label: 'Отказът е заявен на',
        admin: { readOnly: true },
      },
      {
        name: 'status',
        type: 'select',
        label: 'Обработка на отказа',
        options: [
          { value: 'cancelled', label: 'Поръчката е отменена преди обработка' },
          { value: 'pending', label: 'За обработка от Ибис Електроникс' },
          { value: 'processed', label: 'Обработен от Ибис Електроникс' },
        ],
        admin: {
          description:
            'Наличностите не се променят. Връщането и възстановяването на суми се уреждат от Ибис Електроникс.',
        },
      },
      {
        name: 'source',
        type: 'select',
        label: 'Подаден чрез',
        options: [
          { value: 'account', label: 'Профил' },
          { value: 'email', label: 'Потвърден имейл линк' },
        ],
        admin: { readOnly: true },
      },
      {
        name: 'customerNotifiedAt',
        type: 'date',
        label: 'Потвърждение до клиента',
        admin: { readOnly: true },
      },
      {
        name: 'adminNotifiedAt',
        type: 'date',
        label: 'Известие до Ибис Електроникс',
        admin: { readOnly: true },
      },
    ],
  },
  {
    name: 'withdrawalLinkSentAt',
    type: 'date',
    access: { create: () => false, update: () => false, read: adminOnlyFieldAccess },
    admin: { hidden: true },
  },
]
