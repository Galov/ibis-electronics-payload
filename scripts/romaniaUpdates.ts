import 'dotenv/config'
import { assertUpdatesEnabled } from '@/services/romaniaUpdates/transport'

async function main() {
  const [action = 'list', rawLimit = '50', ...extra] = process.argv
    .slice(2)
    .filter((arg) => arg !== '--')
  if (
    extra.length ||
    !['list', 'retry', 'status'].includes(action) ||
    !/^\d+$/.test(rawLimit) ||
    Number(rawLimit) < 1 ||
    Number(rawLimit) > 100
  ) {
    throw new Error('Usage: romania:updates list|retry|status [limit:1-100]')
  }
  // This guard runs before config/DB initialization, including in a network-disabled container.
  if (action !== 'list') assertUpdatesEnabled()
  const [{ default: config }, { getPayload }, { deliverRomaniaUpdate }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
    import('@/services/romaniaUpdates'),
  ])
  const payload = await getPayload({ config })
  try {
    const records = await payload.find({
      collection: 'romania-update-streams',
      depth: 0,
      limit: Number(rawLimit),
      sort: 'updatedAt',
      overrideAccess: true,
      where: {
        status: { in: action === 'status' ? ['accepted'] : ['pending', 'accepted', 'failed'] },
      },
    })
    for (const record of records.docs) {
      if (action !== 'list') await deliverRomaniaUpdate({ payload, id: record.id })
      const current =
        action === 'list'
          ? record
          : await payload.findByID({
              collection: 'romania-update-streams',
              id: record.id,
              depth: 0,
              overrideAccess: true,
            })
      console.log(
        JSON.stringify({
          id: current.id,
          sourceProductId: current.sourceProductId,
          kind: current.kind,
          revision: current.revision,
          status: current.status,
          errorCode: current.lastErrorCode,
        }),
      )
    }
    console.log(
      JSON.stringify({ processed: records.docs.length, matchingAtStart: records.totalDocs }),
    )
  } finally {
    await payload.destroy()
  }
}

main().catch((error) => {
  const message =
    error instanceof Error &&
    (/^ROMANIA_UPDATES_[A-Z_0-9]+$/.test(error.message) || error.message.startsWith('Usage:'))
      ? error.message
      : 'ROMANIA_UPDATES_COMMAND_FAILED'
  console.error(JSON.stringify({ code: message }))
  process.exitCode = 1
})
