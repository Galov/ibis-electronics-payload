import 'dotenv/config'

import { setTimeout as sleep } from 'node:timers/promises'

import {
  getEnabledCatalogSyncWorkerActions,
  runCatalogSyncOutboxBatch,
} from '@/services/catalogSync'

const pollIntervalMs = 5_000
const disabledIntervalMs = 60_000

const run = async () => {
  const enabledActions = getEnabledCatalogSyncWorkerActions()
  if (enabledActions.length === 0) {
    console.log(
      JSON.stringify({
        code: 'CATALOG_SYNC_SEND_DISABLED',
        message: 'Catalog sync worker is idle because content and commerce sending are disabled.',
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
      await runCatalogSyncOutboxBatch({ enabledActions, payload })
    } catch (error) {
      payload.logger.error({ err: error, msg: 'Catalog sync outbox batch failed' })
    }
    await sleep(pollIntervalMs)
  }
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      code: 'CATALOG_SYNC_WORKER_FAILED',
      message: error instanceof Error ? error.message : 'Catalog sync worker failed.',
    }),
  )
  process.exit(1)
})
