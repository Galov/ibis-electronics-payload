import type { PayloadHandler } from 'payload'
import { checkRole } from '@/access/utilities'
import { merchantEnabled } from './client'

// Explicit admin-only initial backfill. No unauthenticated HTTP trigger.
export const queueMerchantReconciliation: PayloadHandler = async (req) => {
  if (!checkRole(['admin'], req.user))
    return Response.json({ message: 'Нямате право на достъп.' }, { status: 403 })
  if (!merchantEnabled())
    return Response.json({ message: 'Merchant синхронизацията е изключена.' }, { status: 503 })
  const job = await req.payload.jobs.queue({
    task: 'reconcileMerchantProducts',
    input: {},
    queue: 'merchant',
    req,
    overrideAccess: false,
  })
  return Response.json({ jobId: job.id }, { status: 202 })
}
