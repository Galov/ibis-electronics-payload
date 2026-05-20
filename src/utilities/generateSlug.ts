import type { CollectionSlug, PayloadRequest } from 'payload'

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

export const generateSlug = (value: string) =>
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

export const resolveUniqueSlug = async ({
  baseSlug,
  collection,
  currentID,
  req,
}: {
  baseSlug: string
  collection: CollectionSlug
  currentID?: string | null
  req: PayloadRequest
}) => {
  let candidate = baseSlug
  let suffix = 2

  while (candidate) {
    const existing = await req.payload.find({
      collection,
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
