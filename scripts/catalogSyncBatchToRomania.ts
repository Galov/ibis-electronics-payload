import 'dotenv/config'

import { CatalogSyncError } from '@/services/catalogSync/errors'
import { assertCatalogSyncSendingEnabled } from '@/services/catalogSync/transport'
import type { CatalogSyncBatchMode } from '@/services/catalogSync/batch'

const usage = [
  'Usage:',
  '  pnpm catalog-sync:batch -- dry-run',
  '  pnpm catalog-sync:batch -- send [--limit 20] [--timeout-ms 600000] [--poll-interval-ms 2000]',
  '  pnpm catalog-sync:batch -- retry-failed [--limit 20] [--timeout-ms 600000] [--poll-interval-ms 2000]',
].join('\n')

const parsePositiveInteger = (value: string | undefined, option: string) => {
  const parsed = Number(value)
  if (!value || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CatalogSyncError(
      'CATALOG_SYNC_INVALID_COMMAND',
      `${option} requires a positive integer.\n${usage}`,
    )
  }
  return parsed
}

const parseArguments = () => {
  const args = process.argv.slice(2)
  if (args[0] === '--') args.shift()
  let mode: CatalogSyncBatchMode = 'dry-run'
  if (args[0] && !args[0].startsWith('--')) {
    if (!['dry-run', 'retry-failed', 'send'].includes(args[0])) {
      throw new CatalogSyncError('CATALOG_SYNC_INVALID_COMMAND', usage)
    }
    mode = args.shift() as CatalogSyncBatchMode
  }

  const options = { limit: 20, pollIntervalMs: 2_000, timeoutMs: 600_000 }
  while (args.length) {
    const option = args.shift()
    const value = args.shift()
    if (option === '--limit') options.limit = parsePositiveInteger(value, option)
    else if (option === '--timeout-ms') options.timeoutMs = parsePositiveInteger(value, option)
    else if (option === '--poll-interval-ms') {
      options.pollIntervalMs = parsePositiveInteger(value, option)
    } else {
      throw new CatalogSyncError('CATALOG_SYNC_INVALID_COMMAND', usage)
    }
  }
  return { mode, ...options }
}

const run = async () => {
  const options = parseArguments()
  if (options.mode !== 'dry-run') assertCatalogSyncSendingEnabled()

  const [{ default: configPromise }, { createLocalReq, getPayload }, { runCatalogSyncBatch }] =
    await Promise.all([
      import('@payload-config'),
      import('payload'),
      import('@/services/catalogSync/batch'),
    ])
  const payload = await getPayload({ config: configPromise })
  const req = await createLocalReq({}, payload)
  const report = await runCatalogSyncBatch({
    ...options,
    onResult: (result) => console.log(JSON.stringify({ type: 'product', ...result })),
    req,
  })
  console.log(JSON.stringify({ type: 'summary', ...report }))
}

run()
  .catch((error: unknown) => {
    if (error instanceof CatalogSyncError) {
      console.error(JSON.stringify({ code: error.code, message: error.message }))
    } else {
      console.error(
        JSON.stringify({
          code: 'CATALOG_SYNC_BATCH_UNEXPECTED_ERROR',
          message:
            error instanceof Error ? error.message : 'Catalog Sync batch failed unexpectedly.',
        }),
      )
    }
    process.exitCode = 1
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode || 0), 0))
