import { adminOnly } from '@/access/adminOnly'
import { slugField } from 'payload'
import type { CollectionConfig } from 'payload'

export const Brands: CollectionConfig = {
  slug: 'brands',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'productCount'],
    useAsTitle: 'title',
    group: 'Каталог',
  },
  labels: {
    plural: 'Марки',
    singular: 'Марка',
  },
  fields: [
    {
      name: 'sourceTermId',
      label: 'ID на изходния термин',
      type: 'number',
      admin: {
        hidden: true,
      },
      index: true,
      unique: true,
    },
    {
      name: 'sourceTaxonomyId',
      label: 'ID на изходната таксономия',
      type: 'number',
      admin: {
        hidden: true,
      },
      index: true,
      unique: true,
    },
    {
      name: 'title',
      label: 'Име',
      type: 'text',
      required: true,
    },
    {
      name: 'productCount',
      label: 'Брой продукти',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    slugField({
      position: undefined,
    }),
  ],
}
