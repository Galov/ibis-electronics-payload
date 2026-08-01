import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { revalidateGlobal } from '@/hooks/revalidateGlobal'

const bannerFields = (label: string) => ({
  name:
    label === 'Горен банер'
      ? 'topBanner'
      : label === 'Долен банер'
        ? 'bottomBanner'
        : 'productBanner',
  label,
  type: 'group' as const,
  fields: [
    {
      name: 'image',
      label: 'Изображение',
      type: 'upload' as const,
      relationTo: 'media' as const,
    },
    {
      name: 'url',
      label: 'Линк',
      type: 'text' as const,
      admin: {
        description: 'Незадължително. Ако е попълнен, банерът ще води към този адрес.',
      },
    },
    {
      name: 'openInNewTab',
      label: 'Отвори в нов раздел',
      type: 'checkbox' as const,
      defaultValue: false,
    },
  ],
})

export const ShopPage: GlobalConfig = {
  slug: 'shopPage',
  label: 'Каталог',
  access: {
    read: () => true,
    update: adminOnly,
  },
  admin: {
    group: 'Сайт',
  },
  hooks: {
    afterChange: [revalidateGlobal],
  },
  fields: [
    bannerFields('Горен банер'),
    bannerFields('Долен банер'),
    bannerFields('Банер в продуктова страница'),
  ],
}
