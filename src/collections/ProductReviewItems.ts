import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { checkRole } from '@/access/utilities'

export const ProductReviewItems: CollectionConfig = {
  slug: 'product-review-items',
  access: {
    admin: ({ req: { user } }) => checkRole(['admin'], user),
    create: () => false,
    delete: () => false,
    read: adminOnly,
    update: () => false,
  },
  admin: {
    defaultColumns: [
      'productTitle',
      'productSku',
      'productCreatedSource',
      'reviewRequiredAt',
      'reviewActions',
    ],
    description: 'Единен списък на новите продукти, които очакват преглед от администратор.',
    group: 'Каталог',
    useAsTitle: 'productTitle',
  },
  labels: {
    plural: 'Продукти за преглед',
    singular: 'Продукт за преглед',
  },
  fields: [
    {
      name: 'product',
      label: 'Продукт',
      type: 'relationship',
      index: true,
      relationTo: 'products',
      required: true,
      unique: true,
    },
    {
      name: 'productTitle',
      label: 'Име',
      type: 'text',
      required: true,
    },
    {
      name: 'productSku',
      label: 'SKU',
      type: 'text',
    },
    {
      name: 'productSlug',
      label: 'Slug',
      type: 'text',
    },
    {
      name: 'productCreatedSource',
      label: 'Източник',
      type: 'select',
      defaultValue: 'manual',
      options: [
        {
          label: 'Ръчно',
          value: 'manual',
        },
        {
          label: 'НИК',
          value: 'nik',
        },
        {
          label: 'Друг източник',
          value: 'other',
        },
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
        {
          label: 'За преглед',
          value: 'pending',
        },
        {
          label: 'Прегледан',
          value: 'reviewed',
        },
      ],
      required: true,
    },
    {
      name: 'reviewRequiredAt',
      label: 'За преглед от',
      type: 'date',
      index: true,
      required: true,
    },
    {
      name: 'reviewedAt',
      label: 'Прегледан на',
      type: 'date',
    },
    {
      name: 'reviewedBy',
      label: 'Прегледан от',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'reviewActions',
      label: 'Действия',
      type: 'ui',
      admin: {
        components: {
          Cell: {
            exportName: 'ProductReviewActionsCell',
            path: '@/components/admin/ProductReviewActionsCell',
          },
        },
      },
    },
  ],
  timestamps: true,
}
