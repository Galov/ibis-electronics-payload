import 'dotenv/config'

import { setTimeout as sleep } from 'node:timers/promises'

import {
  assertCatalogSyncSendingEnabled,
  CatalogSyncError,
  runCatalogSyncOutboxBatch,
} from '@/services/catalogSync'

const pollIntervalMs = 5_000
const disabledIntervalMs = 60_000

const run = async () => {
  try {
    assertCatalogSyncSendingEnabled()
  } catch (error) {
    if (!(error instanceof CatalogSyncError) || error.code !== 'CATALOG_SYNC_SEND_DISABLED') {
      throw error
    }
    console.log(
      JSON.stringify({
        code: error.code,
        message: 'Catalog sync worker is idle because sending is disabled.',
      }),
    )
    while (true) await sleep(disabledIntervalMs)
  }

  const [{ default: configPromise }, { getPayload }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
  ])
  const payload = await getPayload({ config: configPromise })

  while (true) {
    try {
      await runCatalogSyncOutboxBatch({ payload })
    } catch (error) {
      payload.logger.error({ err: error, msg: 'Catalog sync outbox batch failed' })
    }
    await sleep(pollIntervalMs)
  }
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      code: error instanceof CatalogSyncError ? error.code : 'CATALOG_SYNC_WORKER_FAILED',
      message: error instanceof Error ? error.message : 'Catalog sync worker failed.',
    }),
  )
  process.exit(1)
})
