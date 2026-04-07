import fs from 'node:fs'
import readline from 'node:readline'

import { decodeSQLValue, parseInsertStatement } from './sql'
import type {
  LegacyAttachmentRecord,
  LegacyPostRecord,
  LegacySourceData,
  LegacyTermRecord,
  LegacyTermTaxonomyRecord,
} from './types'

const TARGET_TABLES = new Set([
  'nk_posts',
  'nk_postmeta',
  'nk_terms',
  'nk_term_taxonomy',
  'nk_term_relationships',
])

const PRODUCT_META_KEYS = new Set([
  '_sku',
  '_stock',
  '_stock_status',
  '_manage_stock',
  '_backorders',
  '_thumbnail_id',
  '_product_image_gallery',
  'product_original_sku',
  'product_manufacturer',
])

const ATTACHMENT_META_KEYS = new Set(['_wp_attached_file', '_wp_attachment_image_alt'])

export async function parseWooCommerceDump(filePath: string): Promise<LegacySourceData> {
  const source: LegacySourceData = {
    attachments: new Map(),
    postMeta: new Map(),
    posts: new Map(),
    termRelationships: new Map(),
    termTaxonomies: new Map(),
    terms: new Map(),
  }

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const reader = readline.createInterface({ crlfDelay: Infinity, input: stream })

  let activeTable: string | null = null
  let statement = ''

  for await (const line of reader) {
    if (!activeTable) {
      const insertMatch = line.match(/^INSERT INTO `([^`]+)`/)
      const table = insertMatch?.[1]

      if (!table || !TARGET_TABLES.has(table)) continue

      activeTable = table
      statement = line
    } else {
      statement += `\n${line}`
    }

    if (!activeTable || !line.trim().endsWith(';')) continue

    const parsed = parseInsertStatement(statement)

    if (parsed) {
      ingestStatement(source, parsed.table, parsed.columns, parsed.rows)
    }

    activeTable = null
    statement = ''
  }

  return source
}

function ingestStatement(source: LegacySourceData, table: string, columns: string[], rows: string[][]): void {
  for (const row of rows) {
    const record = toRecord(columns, row)

    if (!record) continue

    switch (table) {
      case 'nk_posts':
        ingestPostRow(source, record)
        break
      case 'nk_postmeta':
        ingestPostMetaRow(source, record)
        break
      case 'nk_terms':
        ingestTermRow(source, record)
        break
      case 'nk_term_taxonomy':
        ingestTermTaxonomyRow(source, record)
        break
      case 'nk_term_relationships':
        ingestRelationshipRow(source, record)
        break
      default:
        break
    }
  }
}

function toRecord(columns: string[], row: string[]): Record<string, string | null> | null {
  if (columns.length !== row.length) return null

  const record: Record<string, string | null> = {}

  for (const [index, column] of columns.entries()) {
    record[column] = decodeSQLValue(row[index] || '')
  }

  return record
}

function ingestPostRow(source: LegacySourceData, record: Record<string, string | null>): void {
  const id = toNumber(record.ID)
  const postType = record.post_type

  if (!id || !postType) return

  if (postType === 'product') {
    const product: LegacyPostRecord = {
      content: record.post_content || '',
      excerpt: record.post_excerpt || '',
      guid: record.guid || '',
      id,
      modifiedAt: record.post_modified_gmt || record.post_modified || '',
      slug: record.post_name || '',
      status: record.post_status || '',
      title: record.post_title || '',
    }

    source.posts.set(id, product)
    return
  }

  if (postType === 'attachment') {
    const attachment: LegacyAttachmentRecord = {
      guid: record.guid || '',
      id,
    }

    source.attachments.set(id, attachment)
  }
}

function ingestPostMetaRow(source: LegacySourceData, record: Record<string, string | null>): void {
  const postId = toNumber(record.post_id)
  const key = record.meta_key

  if (!postId || !key) return

  if (PRODUCT_META_KEYS.has(key)) {
    const meta = source.postMeta.get(postId) || new Map<string, string>()
    meta.set(key, record.meta_value || '')
    source.postMeta.set(postId, meta)
    return
  }

  if (!ATTACHMENT_META_KEYS.has(key)) return

  const attachment = source.attachments.get(postId) || { guid: '', id: postId }

  if (key === '_wp_attached_file') attachment.filePath = record.meta_value || undefined
  if (key === '_wp_attachment_image_alt') attachment.alt = record.meta_value || undefined

  source.attachments.set(postId, attachment)
}

function ingestTermRow(source: LegacySourceData, record: Record<string, string | null>): void {
  const id = toNumber(record.term_id)

  if (!id) return

  const term: LegacyTermRecord = {
    id,
    name: record.name || '',
    slug: record.slug || '',
  }

  source.terms.set(id, term)
}

function ingestTermTaxonomyRow(source: LegacySourceData, record: Record<string, string | null>): void {
  const id = toNumber(record.term_taxonomy_id)
  const termId = toNumber(record.term_id)

  if (!id || !termId || !record.taxonomy) return

  const taxonomy: LegacyTermTaxonomyRecord = {
    count: toNumber(record.count) || 0,
    id,
    parent: toNumber(record.parent) || 0,
    taxonomy: record.taxonomy,
    termId,
  }

  source.termTaxonomies.set(id, taxonomy)
}

function ingestRelationshipRow(source: LegacySourceData, record: Record<string, string | null>): void {
  const objectId = toNumber(record.object_id)
  const taxonomyId = toNumber(record.term_taxonomy_id)

  if (!objectId || !taxonomyId) return

  const relationships = source.termRelationships.get(objectId) || []
  relationships.push(taxonomyId)
  source.termRelationships.set(objectId, relationships)
}

function toNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
