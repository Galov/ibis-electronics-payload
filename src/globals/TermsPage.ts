import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { fullLexicalEditor } from '@/fields/fullLexicalEditor'
import { buildSEOFields } from '@/fields/seo'

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
      editor: fullLexicalEditor(),
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
