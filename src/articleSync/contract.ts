import { createHash } from 'node:crypto'

// This file is mirrored in BG. Keep the contract and its golden tests identical.
export type Tree = Record<string, any>
export type ArticleMedia = {
  sourceMediaId: string
  filename: string
  bucket: string
  mimeType: string
  width: number
  height: number
  filesize: number
  alt: string
  caption: Tree | null
}
export type Article = {
  sourceArticleId: string
  title: string
  excerpt: string
  content: Tree
  seoTitle: string | null
  seoDescription: string | null
  seoImage: string | null
  featuredImage: string | null
  sourcePublishedAt: string | null
  categories: { sourceCategoryId: string; title: string }[]
  relatedPosts: string[]
  media: ArticleMedia[]
  links: { url: string; collection: 'posts' | 'products'; sourceId: string }[]
}
export type ArticleEvent = {
  schemaVersion: 'blog-1.0'
  eventId: string
  sourceRevision: number
  sourceUpdatedAt: string
  sourceContentHash: string
  article: Article
}
export class ArticleError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
export const canonical = (value: any): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`
  return JSON.stringify(value)
}
export const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')
export const eventID = (id: string, revision: number, contentHash: string) =>
  `bg-article-${hash([id, revision, contentHash])}`
const object = (v: any, keys: string[]) => {
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.keys(v).sort().join('|') !== [...keys].sort().join('|')
  )
    throw new ArticleError('Невалидни или липсващи полета в договора за статия.')
}
const string = (v: any, max = 2000) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new ArticleError('Невалиден текст в статията.')
}
const nullable = (v: any, max = 2000) => {
  if (v !== null) string(v, max)
}
const id = (v: any) => {
  if (typeof v !== 'string' || !/^[a-f0-9]{24}$/.test(v))
    throw new ArticleError('Невалиден изходен ID.')
}
const date = (v: any) => {
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v)
    throw new ArticleError('Невалидна дата.')
}
const list = (v: any, max: number) => {
  if (!Array.isArray(v) || v.length > max) throw new ArticleError('Невалиден списък.')
}
export const safeURL = (v: string) => /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(v)
const nodeTypes = new Set([
  'root',
  'paragraph',
  'text',
  'heading',
  'quote',
  'list',
  'listitem',
  'link',
  'autolink',
  'linebreak',
  'horizontalrule',
  'upload',
  'table',
  'tablerow',
  'tablecell',
  'tab',
])
export function validateTree(tree: any) {
  if (!tree?.root || tree.root.type !== 'root')
    throw new ArticleError('Липсва rich-text структура.')
  let count = 0
  const visit = (v: any, depth: number) => {
    if (depth > 60 || ++count > 30000) throw new ArticleError('Статията е прекалено сложна.')
    if (!v || typeof v !== 'object') return
    if (v.type && !nodeTypes.has(v.type))
      throw new ArticleError(`Неподдържан rich-text елемент: ${String(v.type).slice(0, 60)}`)
    for (const [k, item] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype', 'html'].includes(k))
        throw new ArticleError('Неподдържано rich-text поле.')
      if (k === 'url' && (typeof item !== 'string' || !safeURL(item)))
        throw new ArticleError('Невалидна връзка.')
      if (k === 'text' && typeof item !== 'string')
        throw new ArticleError('Невалиден rich-text текст.')
      if (typeof item === 'object') visit(item, depth + 1)
    }
  }
  visit(tree, 0)
}
export function parseArticleEvent(value: unknown): ArticleEvent {
  const v = value as ArticleEvent
  if (Buffer.byteLength(JSON.stringify(value) || '') > 1_000_000)
    throw new ArticleError('Статията надвишава 1 MB.')
  object(v, [
    'schemaVersion',
    'eventId',
    'sourceRevision',
    'sourceUpdatedAt',
    'sourceContentHash',
    'article',
  ])
  if (
    v.schemaVersion !== 'blog-1.0' ||
    !Number.isSafeInteger(v.sourceRevision) ||
    v.sourceRevision < 1
  )
    throw new ArticleError('Невалидна версия.')
  date(v.sourceUpdatedAt)
  const a = v.article
  object(a, [
    'sourceArticleId',
    'title',
    'excerpt',
    'content',
    'seoTitle',
    'seoDescription',
    'seoImage',
    'featuredImage',
    'sourcePublishedAt',
    'categories',
    'relatedPosts',
    'media',
    'links',
  ])
  id(a.sourceArticleId)
  string(a.title)
  string(a.excerpt, 20000)
  validateTree(a.content)
  nullable(a.seoTitle)
  nullable(a.seoDescription, 10000)
  if (a.sourcePublishedAt !== null) date(a.sourcePublishedAt)
  if (a.featuredImage !== null) id(a.featuredImage)
  if (a.seoImage !== null) id(a.seoImage)
  list(a.categories, 100)
  list(a.relatedPosts, 4)
  list(a.media, 100)
  list(a.links, 500)
  a.categories.forEach((c) => {
    object(c, ['sourceCategoryId', 'title'])
    id(c.sourceCategoryId)
    string(c.title)
  })
  a.relatedPosts.forEach(id)
  a.links.forEach((l) => {
    object(l, ['url', 'collection', 'sourceId'])
    string(l.url, 10000)
    if (!safeURL(l.url) || !['posts', 'products'].includes(l.collection))
      throw new ArticleError('Невалидна вътрешна връзка.')
    id(l.sourceId)
  })
  for (const m of a.media) {
    object(m, [
      'sourceMediaId',
      'filename',
      'bucket',
      'mimeType',
      'width',
      'height',
      'filesize',
      'alt',
      'caption',
    ])
    id(m.sourceMediaId)
    string(m.filename)
    string(m.bucket)
    string(m.mimeType)
    if (
      /[\/\\]|\.\.|[\x00-\x1f]/.test(m.filename) ||
      !/^image\/(jpeg|png|webp|gif|avif)$/.test(m.mimeType)
    )
      throw new ArticleError('Неподдържано изображение.')
    for (const n of [m.width, m.height, m.filesize])
      if (!Number.isFinite(n) || n <= 0) throw new ArticleError('Липсват размери на изображение.')
    if (typeof m.alt !== 'string' || m.alt.length > 10000)
      throw new ArticleError('Невалиден alt текст.')
    if (m.caption !== null) {
      validateTree(m.caption)
      walk(m.caption, (node) => {
        if (['upload', 'relationship'].includes(node.type) || node.fields?.linkType === 'internal')
          throw new ArticleError('Надписът на снимка съдържа неподдържана вградена връзка.')
        if (typeof node.fields?.url === 'string' && node.fields.url.startsWith('/'))
          throw new ArticleError('Надписът на снимка изисква абсолютна връзка.')
      })
    }
  }
  for (const ids of [
    a.media.map((m) => m.sourceMediaId),
    a.categories.map((c) => c.sourceCategoryId),
    a.relatedPosts,
  ])
    if (new Set(ids).size !== ids.length) throw new ArticleError('Дублиран идентификатор.')
  const mediaIDs = new Set(a.media.map((m) => m.sourceMediaId))
  for (const key of [a.featuredImage, a.seoImage])
    if (key && !mediaIDs.has(key)) throw new ArticleError('Липсва изображение в договора.')
  walk(a.content, (node) => {
    if (node.type === 'upload' && (node.relationTo !== 'media' || !mediaIDs.has(node.value)))
      throw new ArticleError('Липсва вградено изображение.')
    const relation =
      node.type === 'relationship'
        ? node
        : node.fields?.linkType === 'internal'
          ? node.fields.doc
          : null
    if (node.fields?.linkType === 'internal' && !relation)
      throw new ArticleError('Липсва вътрешна връзка.')
    if (relation) {
      if (!['posts', 'products'].includes(relation.relationTo))
        throw new ArticleError('Неподдържана връзка към документ.')
      id(relation.value)
    }
  })
  if (
    v.sourceContentHash !== hash(a) ||
    v.eventId !== eventID(a.sourceArticleId, v.sourceRevision, v.sourceContentHash)
  )
    throw new ArticleError('Невалиден отпечатък на статията.')
  return v
}
export function buildArticleEvent(
  article: Article,
  sourceRevision: number,
  sourceUpdatedAt: string,
): ArticleEvent {
  const sourceContentHash = hash(article)
  return parseArticleEvent({
    schemaVersion: 'blog-1.0',
    article,
    sourceRevision,
    sourceUpdatedAt,
    sourceContentHash,
    eventId: eventID(article.sourceArticleId, sourceRevision, sourceContentHash),
  })
}
export function walk(value: any, visit: (node: Tree) => void) {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value)) visit(value)
  for (const child of Object.values(value))
    if (child && typeof child === 'object') walk(child, visit)
}
export type Segment = { key: string; text: string }
export function textSegments(a: Article): Segment[] {
  const result: Segment[] = [
    { key: 'title', text: a.title },
    { key: 'excerpt', text: a.excerpt },
  ]
  for (const k of ['seoTitle', 'seoDescription'] as const)
    if (a[k]) result.push({ key: k, text: a[k]! })
  const collect = (v: any, path: string) => {
    if (!v || typeof v !== 'object') return
    if (typeof v.text === 'string' && v.text.trim())
      result.push({ key: `${path}.text`, text: v.text })
    for (const [k, child] of Object.entries(v))
      if (typeof child === 'object') collect(child, `${path}.${k}`)
  }
  collect(a.content, 'content')
  a.categories.forEach((c, i) => result.push({ key: `categories.${i}.title`, text: c.title }))
  a.media.forEach((m, i) => {
    if (m.alt.trim()) result.push({ key: `media.${i}.alt`, text: m.alt })
    collect(m.caption, `media.${i}.caption`)
  })
  return result
}
export function applySegments(a: Article, translated: Segment[]): Article {
  const expected = textSegments(a)
  if (
    translated.length !== expected.length ||
    new Set(translated.map((s) => s.key)).size !== expected.length ||
    expected.some(
      (s) =>
        !translated.some((t) => t.key === s.key && typeof t.text === 'string' && t.text.trim()),
    )
  )
    throw new ArticleError('Преводът не съответства на текстовите сегменти.')
  const result = structuredClone(a)
  for (const s of translated) {
    const parts = s.key.split('.')
    const key = parts.pop()!
    let target: any = result
    for (const part of parts) target = target[part]
    target[key] = s.text
  }
  return result
}
