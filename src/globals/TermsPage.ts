import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { buildSEOFields } from '@/fields/seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const TermsPage: GlobalConfig = {
  slug: 'terms-page',
  label: 'Условия за ползване',
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
      defaultValue: 'Условия за ползване',
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
