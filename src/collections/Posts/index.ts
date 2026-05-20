import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOrPublishedStatus } from '@/access/adminOrPublishedStatus'
import { fullLexicalEditor } from '@/fields/fullLexicalEditor'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { generateSlug, resolveUniqueSlug } from '@/utilities/generateSlug'

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOrPublishedStatus,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'publishedAt', 'updatedAt'],
    description: 'Статии за блога.',
    group: 'Съдържание',
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          collection: 'posts',
          req,
          slug: data?.slug,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        collection: 'posts',
        req,
        slug: data?.slug as string,
      }),
    useAsTitle: 'title',
  },
  labels: {
    plural: 'Блог статии',
    singular: 'Блог статия',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Основно',
          fields: [
            {
              name: 'title',
              label: 'Заглавие',
              type: 'text',
              required: true,
            },
            {
              name: 'excerpt',
              label: 'Кратко резюме',
              type: 'textarea',
              required: true,
            },
            {
              name: 'featuredImage',
              label: 'Основно изображение',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'publishedAt',
              label: 'Публикувано на',
              type: 'date',
              admin: {
                date: {
                  pickerAppearance: 'dayAndTime',
                },
                position: 'sidebar',
              },
              hooks: {
                beforeChange: [
                  ({ siblingData, value }) => {
                    if (siblingData._status === 'published' && !value) {
                      return new Date()
                    }

                    return value
                  },
                ],
              },
            },
            {
              name: 'categories',
              label: 'Категории',
              type: 'relationship',
              hasMany: true,
              relationTo: 'post-categories',
            },
            {
              name: 'content',
              label: 'Съдържание',
              type: 'richText',
              editor: fullLexicalEditor(),
              required: true,
            },
          ],
        },
        {
          label: 'Свързани',
          fields: [
            {
              name: 'relatedPosts',
              label: 'Свързани статии',
              type: 'relationship',
              admin: {
                description:
                  'Незадължително. Изберете до 4 статии, които да се покажат под публикацията.',
              },
              filterOptions: ({ id }) => {
                if (!id) {
                  return true
                }

                return {
                  id: {
                    not_equals: id,
                  },
                }
              },
              hasMany: true,
              relationTo: 'posts',
              validate: (value) => {
                if (!Array.isArray(value) || value.length <= 4) {
                  return true
                }

                return 'Можете да изберете до 4 свързани статии.'
              },
            },
          ],
        },
      ],
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
              collection: 'posts',
              currentID: typeof originalDoc?.id === 'string' ? originalDoc.id : null,
              req,
            })
          },
        ],
      },
    },
  ],
  versions: {
    drafts: {
      autosave: true,
    },
    maxPerDoc: 50,
  },
}
