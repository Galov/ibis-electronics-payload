import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { buildSEOFields } from '@/fields/seo'
import { buildCategorySlug } from '@/utilities/category'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'parent', 'productCount'],
    useAsTitle: 'title',
    group: 'Каталог',
  },
  labels: {
    plural: 'Категории',
    singular: 'Категория',
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
      name: 'parent',
      label: 'Родителска категория',
      type: 'relationship',
      relationTo: 'categories',
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
    {
      name: 'meta',
      label: 'SEO',
      type: 'group',
      fields: buildSEOFields(),
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      admin: {
        hidden: true,
      },
      hooks: {
        beforeValidate: [
          async ({ data, originalDoc }) => {
            if (typeof data?.slug === 'string' && data.slug) {
              return data.slug
            }

            const title =
              typeof data?.title === 'string'
                ? data.title
                : typeof originalDoc?.title === 'string'
                  ? originalDoc.title
                  : ''

            return buildCategorySlug({ title })
          },
        ],
      },
    },
  ],
}
