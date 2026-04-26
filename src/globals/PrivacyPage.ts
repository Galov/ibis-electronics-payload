import type { GlobalConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { fullLexicalEditor } from '@/fields/fullLexicalEditor'

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
      editor: fullLexicalEditor(),
      label: 'Съдържание',
      required: true,
    },
  ],
}
