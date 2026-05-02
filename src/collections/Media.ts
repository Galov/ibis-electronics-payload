import type { CollectionConfig } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'

import { adminOnly } from '@/access/adminOnly'
import { fullLexicalEditor } from '@/fields/fullLexicalEditor'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const buildPasteURLAllowList = () => {
  const candidates = [
    process.env.NEXT_PUBLIC_SERVER_URL,
    process.env.PAYLOAD_PUBLIC_SERVER_URL,
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
  ].filter((value): value is string => Boolean(value))

  const allowList = candidates.flatMap((value) => {
    try {
      const url = new URL(value)

      return [
        {
          hostname: url.hostname,
          port: url.port || undefined,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        },
      ]
    } catch {
      return []
    }
  })

  return allowList.length > 0 ? allowList : undefined
}

const pasteURLAllowList = buildPasteURLAllowList()

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
    ...(pasteURLAllowList
      ? {
          pasteURL: {
            allowList: pasteURLAllowList,
          },
        }
      : {}),
    staticDir: path.resolve(dirname, '../../public/media'),
  },
}
