import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { buildImportReport, normalizeBrands, normalizeCategories, normalizeProducts } from './mapData'
import { parseWooCommerceDump } from './parseDump'
import { importIntoPayload } from './payloadImport'
import type { ImportOptions } from './types'

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const dump = await parseWooCommerceDump(options.dumpFile)
  const categories = normalizeCategories(dump)
  const brands = normalizeBrands(dump)
  const products = normalizeProducts(dump, options)
  const report = buildImportReport(categories, brands, products)

  printReport(report, options)

  if (options.dryRun) return

  const result = await importIntoPayload({
    batchSize: options.batchSize,
    brands,
    categories,
    products,
  })

  report.failedProducts = result.failedProducts.length
  report.succeededProducts = result.succeededProducts

  const reportFile = writeFailureReport(result.failedProducts)

  console.log('\nImport completed.')
  console.log(`Succeeded products: ${result.succeededProducts}`)
  console.log(`Failed products: ${result.failedProducts.length}`)
  console.log(`Failure report: ${reportFile}`)
}

function parseArgs(args: string[]): ImportOptions & { help: boolean } {
  const defaults: ImportOptions & { help: boolean } = {
    batchSize: 250,
    dryRun: false,
    dumpFile: path.resolve(process.cwd(), '../nikelect_woocdb2019.sql'),
    help: false,
    legacySiteUrl: process.env.LEGACY_SITE_URL,
    uploadsBaseUrl: process.env.LEGACY_UPLOADS_BASE_URL,
  }

  for (const arg of args) {
    if (arg === '--dry-run') defaults.dryRun = true
    else if (arg === '--help' || arg === '-h') defaults.help = true
    else if (arg.startsWith('--dump=')) defaults.dumpFile = path.resolve(process.cwd(), arg.slice(7))
    else if (arg.startsWith('--batch-size=')) defaults.batchSize = Number(arg.slice(13)) || defaults.batchSize
    else if (arg.startsWith('--legacy-site-url=')) defaults.legacySiteUrl = arg.slice(18)
    else if (arg.startsWith('--uploads-base-url=')) defaults.uploadsBaseUrl = arg.slice(19)
  }

  return defaults
}

function printHelp(): void {
  console.log(`
WooCommerce importer

Usage:
  npm run import:woocommerce -- --dry-run
  npm run import:woocommerce -- --dump=../nikelect_woocdb2019.sql --legacy-site-url=https://example.com

Options:
  --dry-run                 Parse and normalize only, do not write to Payload.
  --dump=<path>             SQL dump path. Defaults to ../nikelect_woocdb2019.sql
  --batch-size=<number>     Product import batch size. Defaults to 250
  --legacy-site-url=<url>   Used to build image URLs when attachment guid is missing
  --uploads-base-url=<url>  Explicit uploads base URL, overrides legacy-site-url
  --help                    Show this message
`)
}

function printReport(report: ReturnType<typeof buildImportReport>, options: ImportOptions): void {
  console.log(`\nWooCommerce import report`)
  console.log(`Dump: ${options.dumpFile}`)
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'import'}`)
  console.log(`Categories: ${report.categories}`)
  console.log(`Brands: ${report.brands}`)
  console.log(`Products: ${report.products}`)
  console.log(`Products missing SKU: ${report.productsMissingSku}`)
  console.log(`Products missing images: ${report.productsMissingImages}`)
  console.log(`Products with zero price: ${report.productsWithZeroPrice}`)
  if (typeof report.succeededProducts === 'number') {
    console.log(`Succeeded products: ${report.succeededProducts}`)
  }
  if (typeof report.failedProducts === 'number') {
    console.log(`Failed products: ${report.failedProducts}`)
  }
}

function writeFailureReport(failedProducts: unknown[]): string {
  const reportsDir = path.resolve(process.cwd(), 'reports')
  const timestamp = new Date().toISOString().replaceAll(':', '-')
  const filePath = path.join(reportsDir, `woocommerce-import-errors-${timestamp}.json`)

  fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(failedProducts, null, 2))

  return filePath
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
