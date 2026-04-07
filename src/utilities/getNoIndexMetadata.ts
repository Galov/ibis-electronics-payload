import type { Metadata } from 'next'

import { generateMeta } from '@/utilities/generateMeta'

export const getNoIndexMetadata = async (args: {
  description?: string
  follow?: boolean
  path: string
  title: string
}): Promise<Metadata> => {
  const { description, follow = false, path, title } = args
  const metadata = await generateMeta({
    fallbackDescription: description,
    fallbackTitle: title,
    path,
  })

  return {
    ...metadata,
    robots: {
      follow,
      googleBot: {
        follow,
        index: false,
      },
      index: false,
    },
  }
}
