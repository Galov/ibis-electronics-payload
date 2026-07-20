import 'dotenv/config'

import configPromise from '@payload-config'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload, saveVersion } from 'payload'

import type { Product } from '@/payload-types'

type ComparisonRow = {
  comparisons: {
    publishedMatches: boolean
    sourcePriceMatchesNikRetail: boolean
    stockMatches: boolean
  }
  ibis: {
    id: string
    published: boolean | null
    sku: string | null
    sourceId: number | null
    sourcePrice: number | null
    status: string | null
    stockQty: number | null
  }
  matchType: 'none' | 'sku' | 'sourceId'
  nik: null | {
    published: boolean | null
    sku: string | null
    stockQty: number | null
  }
}

type ComparisonReport = {
  rows: ComparisonRow[]
}

type VersionDoc = {
  id: string
  latest?: boolean
  parent?: string | { id?: string }
  version?: Partial<Product>
}

const reportPath = path.resolve(
  process.cwd(),
  'reports/nik-ibis-version-mismatch/compare-141-with-nik.json',
)
const outputPath = path.resolve(
  process.cwd(),
  'reports/nik-ibis-version-mismatch/repair-119-safe-versions.json',
)

const apply = process.argv.includes('--apply')

const normalizeString = (value: null | string | undefined) => {
  const normalized = value?.trim()
  return normalized || null
}

const isStatusOnlyMismatch = (product: Product, version?: Partial<Product>) => {
  if (!version) {
    return false
  }

  return (
    normalizeString(product.sku) === normalizeString(version.sku) &&
    normalizeString(product.slug) === normalizeString(version.slug) &&
    product._status !== version._status
  )
}

const getSafeRows = (report: ComparisonReport) => {
  return report.rows.filter((row) => {
    return (
      row.matchType !== 'none' &&
      row.comparisons.stockMatches === true &&
      row.comparisons.publishedMatches === true
    )
  })
}

const main = async () => {
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as ComparisonReport
  const safeRows = getSafeRows(report)

  if (safeRows.length !== 119) {
    throw new Error(`Expected exactly 119 safe rows, got ${safeRows.length}.`)
  }

  const payload = await getPayload({ config: configPromise })
  const collectionConfig = payload.collections.products.config
  const checked: Array<Record<string, unknown>> = []
  const repaired: Array<Record<string, unknown>> = []
  const skipped: Array<Record<string, unknown>> = []
  const errors: Array<Record<string, unknown>> = []

  for (const row of safeRows) {
    try {
      const product = await payload.findByID({
        collection: 'products',
        depth: 0,
        id: row.ibis.id,
        overrideAccess: true,
      }) as Product
      const versionsResult = await payload.findVersions({
        collection: 'products',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        pagination: false,
        select: {
          latest: true,
          parent: true,
          version: {
            _status: true,
            sku: true,
            slug: true,
          },
        },
        sort: '-updatedAt',
        where: {
          parent: {
            equals: product.id,
          },
        },
      })
      const latestVersion = versionsResult.docs[0] as unknown as VersionDoc | undefined

      checked.push({
        id: product.id,
        sku: product.sku,
        status: product._status,
        versionId: latestVersion?.id,
        versionStatus: latestVersion?.version?._status,
      })

      if (!isStatusOnlyMismatch(product, latestVersion?.version)) {
        skipped.push({
          id: product.id,
          reason: 'latest-version-is-not-status-only-mismatch',
          sku: product.sku,
          status: product._status,
          versionId: latestVersion?.id,
          versionStatus: latestVersion?.version?._status,
        })
        continue
      }

      if (!apply) {
        continue
      }

      await saveVersion({
        autosave: true,
        collection: collectionConfig,
        docWithLocales: product,
        id: product.id,
        operation: 'update',
        payload,
        returning: false,
      })

      repaired.push({
        id: product.id,
        sku: product.sku,
      })
    } catch (error) {
      errors.push({
        error: error instanceof Error ? error.message : 'Unknown error',
        id: row.ibis.id,
        sku: row.ibis.sku,
      })
    }
  }

  const result = {
    counts: {
      checked: checked.length,
      errors: errors.length,
      repaired: repaired.length,
      safeRows: safeRows.length,
      skipped: skipped.length,
    },
    mode: apply ? 'apply' : 'dry-run',
    samples: {
      errors: errors.slice(0, 20),
      repaired: repaired.slice(0, 20),
      skipped: skipped.slice(0, 20),
    },
  }

  writeFileSync(outputPath, JSON.stringify({ ...result, checked, errors, repaired, skipped }, null, 2))
  console.log(JSON.stringify(result, null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
