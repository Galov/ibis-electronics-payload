import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { buildSEOFields } from '@/fields/seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const PrivacyPage: GlobalConfig = {
  slug: 'privacy-page',
  label: 'Политика за поверителност',
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
      type: 'text',
      defaultValue: 'Политика за поверителност',
      label: 'Заглавие',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor(),
      label: 'Съдържание',
      required: true,
    },
    {
      name: 'meta',
      label: 'SEO',
      type: 'group',
      fields: buildSEOFields(),
    },
  ],
}
