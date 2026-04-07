import type { PayloadHandler } from 'payload'

import { checkRole } from '@/access/utilities'
import { recalculateRetailPrices } from '@/utilities/recalculateRetailPrices'

export const recalculateRetailPricesHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await recalculateRetailPrices()
    return Response.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ message }, { status: 500 })
  }
}
