import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { generateSlug, resolveUniqueSlug } from '@/utilities/generateSlug'

export const PostCategories: CollectionConfig = {
  slug: 'post-categories',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    group: 'Съдържание',
    useAsTitle: 'title',
  },
  labels: {
    plural: 'Категории за блог',
    singular: 'Категория за блог',
  },
  fields: [
    {
      name: 'title',
      label: 'Име',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        hidden: true,
      },
      hooks: {
        beforeValidate: [
          async ({ data, originalDoc, req, value }) => {
            if (typeof value === 'string' && value.trim()) {
              return value
            }

            const title =
              typeof data?.title === 'string'
                ? data.title
                : typeof originalDoc?.title === 'string'
                  ? originalDoc.title
                  : ''

            if (
              typeof originalDoc?.slug === 'string' &&
              typeof originalDoc?.title === 'string' &&
              originalDoc.title === title
            ) {
              return originalDoc.slug
            }

            const baseSlug = generateSlug(title)

            if (!baseSlug) {
              return ''
            }

            return resolveUniqueSlug({
              baseSlug,
              collection: 'post-categories',
              currentID: typeof originalDoc?.id === 'string' ? originalDoc.id : null,
              req,
            })
          },
        ],
      },
    },
  ],
}
