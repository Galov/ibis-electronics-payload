import type { PayloadRequest } from 'payload'
import { ArticleError, walk, type Article, type Tree } from './contract'

const relationID = (v: any): string => (typeof v === 'string' ? v : v?.id)
const nullableText = (v: any) => (typeof v === 'string' && v.trim() ? v : null)
export async function loadArticle(
  sourceArticleId: string,
  req: PayloadRequest,
): Promise<{ article: Article; updatedAt: string }> {
  const p = req.payload
  const read = { depth: 0, overrideAccess: false, user: req.user, req } as const
  const post = await p.findByID({ collection: 'posts', id: sourceArticleId, draft: false, ...read })
  if (post._status !== 'published')
    throw new ArticleError(
      'Първо публикувайте статията в БГ. Изпраща се само запазената публикувана версия.',
    )
  const mediaIDs = new Set<string>()
  const featuredImage = post.featuredImage ? relationID(post.featuredImage) : null
  const seoImage = post.meta?.image ? relationID(post.meta.image) : null
  if (featuredImage) mediaIDs.add(featuredImage)
  if (seoImage) mediaIDs.add(seoImage)
  const content = structuredClone(post.content) as Tree
  const urls = new Set<string>()
  walk(content, (node) => {
    if (node.type === 'upload') {
      node.value = relationID(node.value)
      mediaIDs.add(node.value)
    }
    if (node.type === 'relationship') node.value = relationID(node.value)
    if (node.fields?.doc) node.fields.doc.value = relationID(node.fields.doc.value)
    if (typeof node.fields?.url === 'string') urls.add(node.fields.url)
  })
  const media: Article['media'] = []
  for (const sourceMediaId of mediaIDs) {
    const m = await p.findByID({ collection: 'media', id: sourceMediaId, ...read })
    if (
      !m.filename ||
      ('prefix' in m && m.prefix) ||
      !process.env.R2_BUCKET ||
      !process.env.R2_ENDPOINT ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY
    )
      throw new ArticleError(
        `Снимката ${sourceMediaId} няма поддържан общ R2 адрес. Няма изпратен превод.`,
      )
    media.push({
      sourceMediaId,
      filename: m.filename,
      bucket: process.env.R2_BUCKET,
      mimeType: m.mimeType || '',
      width: m.width || 0,
      height: m.height || 0,
      filesize: m.filesize || 0,
      alt: m.alt || '',
      caption: (m.caption as Tree) || null,
    })
  }
  const categories: Article['categories'] = []
  for (const ref of post.categories || []) {
    const category = await p.findByID({
      collection: 'post-categories',
      id: relationID(ref),
      ...read,
    })
    categories.push({ sourceCategoryId: category.id, title: category.title })
  }
  const links: Article['links'] = []
  for (const url of urls) {
    let parsed: URL
    try {
      parsed = new URL(url, 'https://ibis-electronics.com')
    } catch {
      continue
    }
    if (!['ibis-electronics.com', 'www.ibis-electronics.com'].includes(parsed.hostname)) continue
    const match = parsed.pathname.match(/^\/(blog|products)\/([^/]+)\/?$/)
    if (!match) continue
    const collection = match[1] === 'blog' ? 'posts' : 'products'
    const found = await p.find({
      collection,
      ...read,
      limit: 2,
      where: { slug: { equals: decodeURIComponent(match[2]!) } },
    })
    if (found.docs.length === 1) links.push({ url, collection, sourceId: found.docs[0]!.id })
  }
  return {
    updatedAt: post.updatedAt,
    article: {
      sourceArticleId: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content,
      featuredImage,
      seoImage,
      seoTitle: nullableText(post.meta?.title),
      seoDescription: nullableText(post.meta?.description),
      sourcePublishedAt: post.publishedAt || null,
      categories,
      media,
      links,
      relatedPosts: (post.relatedPosts || []).map(relationID),
    },
  }
}
