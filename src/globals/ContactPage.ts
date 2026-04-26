import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { revalidateGlobal } from '@/hooks/revalidateGlobal'

const locationFields = () => ({
  name: 'store',
  label: 'Контактна информация',
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
    {
      name: 'mapQuery',
      label: 'Адрес за карта',
      type: 'text' as const,
      admin: {
        description:
          'Въведи адрес или текст за търсене в Google Maps. Не поставяй embed/iframe код. Ако е празно, ще се използва основният адрес.',
      },
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
  hooks: {
    afterChange: [revalidateGlobal],
  },
  fields: [
    {
      name: 'title',
      label: 'Заглавие',
      type: 'text',
      defaultValue: 'Контакт',
      required: true,
    },
    locationFields(),
  ],
}
