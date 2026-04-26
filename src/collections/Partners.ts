import { adminOnly } from '@/access/adminOnly'
import type { CollectionConfig } from 'payload'

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: 'y',
  ю: 'yu',
  я: 'ya',
}

const generatePartnerSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] ?? char)
    .join('')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

const resolveUniquePartnerSlug = async ({
  baseSlug,
  currentID,
  req,
}: {
  baseSlug: string
  currentID?: string | null
  req: any
}) => {
  let candidate = baseSlug
  let suffix = 2

  while (candidate) {
    const existing = await req.payload.find({
      collection: 'partners',
      depth: 0,
      limit: 1,
      pagination: false,
      where: {
        slug: {
          equals: candidate,
        },
      },
    })

    const conflictingDoc = existing.docs[0]

    if (!conflictingDoc || conflictingDoc.id === currentID) {
      return candidate
    }

    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return baseSlug
}

export const Partners: CollectionConfig = {
  slug: 'partners',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Съдържание',
    hidden: true,
    defaultColumns: ['title', 'phone', 'website'],
  },
  labels: {
    plural: 'Партньори',
    singular: 'Партньор',
  },
  fields: [
    {
      name: 'title',
      label: 'Име',
      type: 'text',
      required: true,
    },
    {
      name: 'address',
      label: 'Адрес',
      type: 'textarea',
      required: true,
    },
    {
      name: 'city',
      label: 'Град',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      label: 'Телефон',
      type: 'text',
      required: true,
    },
    {
      name: 'workingHours',
      label: 'Работно време',
      type: 'textarea',
      required: true,
    },
    {
      name: 'website',
      label: 'Уебсайт',
      type: 'text',
      admin: {
        description: 'Незадължително. Например: https://example.com',
      },
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
          async ({ data, originalDoc, req }) => {
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

            const baseSlug = generatePartnerSlug(title)

            return resolveUniquePartnerSlug({
              baseSlug,
              currentID: typeof originalDoc?.id === 'string' ? originalDoc.id : null,
              req,
            })
          },
        ],
      },
    },
  ],
}
