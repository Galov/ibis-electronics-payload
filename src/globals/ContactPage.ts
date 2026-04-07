import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { buildSEOFields } from '@/fields/seo'

const locationFields = (label: string) => ({
  name: label === 'Магазин' ? 'store' : 'warehouse',
  label,
  type: 'group' as const,
  fields: [
    {
      name: 'address',
      label: 'Адрес',
      type: 'textarea' as const,
      required: true,
    },
    {
      name: 'phone',
      label: 'Телефон',
      type: 'text' as const,
      required: true,
    },
    {
      name: 'workingHours',
      label: 'Работно време',
      type: 'textarea' as const,
      required: true,
    },
  ],
})

export const ContactPage: GlobalConfig = {
  slug: 'contact-page',
  label: 'Контакт',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Съдържание',
  },
  fields: [
    {
      name: 'title',
      label: 'Заглавие',
      type: 'text',
      defaultValue: 'Контакт',
      required: true,
    },
    locationFields('Магазин'),
    locationFields('Склад'),
    {
      name: 'meta',
      label: 'SEO',
      type: 'group',
      fields: buildSEOFields(),
    },
  ],
}
