import { getBaseURL } from '@/utilities/getBaseURL'

export default function robots() {
  const baseUrl = getBaseURL()

  return {
    host: baseUrl,
    rules: [
      {
        disallow: ['/admin', '/api'],
        userAgent: '*',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
