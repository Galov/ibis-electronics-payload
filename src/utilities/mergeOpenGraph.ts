import type { Metadata } from 'next'

import { getSocialImageURL } from '@/utilities/getSocialImageURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: 'Каталог с продукти, партньори и информация за Ibis Electronics.',
  images: [
    {
      url: getSocialImageURL('/logo.png'),
    },
  ],
  siteName: 'Ibis Electronics',
  title: 'Ibis Electronics',
}

export const mergeOpenGraph = (og?: Partial<Metadata['openGraph']>): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
