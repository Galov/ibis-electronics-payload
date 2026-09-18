import { afterEach, describe, expect, it } from 'vitest'

import { generateMeta, withFallbackMetaImage } from '@/utilities/generateMeta'

const originalServerURL = process.env.NEXT_PUBLIC_SERVER_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_SERVER_URL = originalServerURL
})

describe('product SEO image fallback', () => {
  it('keeps configured SEO text and uses the migrated product image when Meta Image is empty', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://ibis-electronics.com'
    const migratedImageURL = 'https://media.ibis-electronics.com/products/107610/1-167mi07.jpg'

    const metadata = await generateMeta({
      doc: {
        meta: withFallbackMetaImage(
          {
            description: 'SEO description',
            title: 'SEO title',
          },
          {
            alt: 'Product image',
            url: migratedImageURL,
          },
        ),
      },
      path: '/products/miele-91',
    })

    expect(metadata.title).toBe('SEO title')
    expect(metadata.description).toBe('SEO description')
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: migratedImageURL }],
    })
    expect(metadata.twitter).toMatchObject({
      images: [migratedImageURL],
    })
  })

  it('keeps an explicitly configured Meta Image instead of the product fallback', () => {
    const meta = withFallbackMetaImage(
      {
        image: {
          url: 'https://media.ibis-electronics.com/seo/custom.jpg',
        },
      },
      {
        url: 'https://media.ibis-electronics.com/products/product.jpg',
      },
    )

    expect(meta?.image).toEqual({
      url: 'https://media.ibis-electronics.com/seo/custom.jpg',
    })
  })
})
