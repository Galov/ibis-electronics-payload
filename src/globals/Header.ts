import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { link } from '@/fields/link'

export const Header: GlobalConfig = {
  slug: 'header',
  label: 'Хедър',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Сайт',
  },
  fields: [
    {
      name: 'navItems',
      label: 'Навигационно меню',
      type: 'array',
      labels: {
        plural: 'Навигационни връзки',
        singular: 'Навигационна връзка',
      },
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
  ],
}
