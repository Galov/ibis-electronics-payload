import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

export const OrderSettings: GlobalConfig = {
  slug: 'order-settings',
  label: 'Известия за поръчки',
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    group: 'Сайт',
  },
  fields: [
    {
      name: 'notificationRecipients',
      label: 'Получатели на имейл при нова поръчка',
      type: 'array',
      admin: {
        description: 'На тези имейл адреси ще се изпраща известие при успешно направена поръчка.',
      },
      fields: [
        {
          name: 'email',
          label: 'Имейл адрес',
          type: 'email',
          required: true,
        },
      ],
      labels: {
        plural: 'Получатели',
        singular: 'Получател',
      },
    },
  ],
}
