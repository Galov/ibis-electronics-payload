import type { CollectionConfig } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'

import { adminOnly } from '@/access/adminOnly'
import { fullLexicalEditor } from '@/fields/fullLexicalEditor'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  admin: {
    group: 'Съдържание',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
  },
  labels: {
    plural: 'Медия',
    singular: 'Медия',
  },
  slug: 'media',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'alt',
      label: 'Alt текст',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      label: 'Надпис',
      type: 'richText',
      editor: fullLexicalEditor(),
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
  },
}
