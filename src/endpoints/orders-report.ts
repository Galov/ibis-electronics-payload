import type { PayloadHandler } from 'payload'

import { checkRole } from '@/access/utilities'
import { buildOrdersCsv, buildOrdersReportSummary, fetchOrdersForMonth } from '@/utilities/orderReports'

const badRequest = (message: string) => Response.json({ message }, { status: 400 })

export const ordersReportHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url || 'http://localhost')
    const month = url.searchParams.get('month')
    const format = url.searchParams.get('format') || 'json'

    if (!month) {
      return badRequest('Липсва month. Използвайте формат YYYY-MM.')
    }

    if (format !== 'json' && format !== 'csv') {
      return badRequest('Неподдържан format. Използвайте json или csv.')
    }

    const orders = await fetchOrdersForMonth({ month, req })

    if (format === 'csv') {
      const csv = buildOrdersCsv({ month, orders })

      return new Response(csv, {
        headers: {
          'Content-Disposition': `attachment; filename=\"orders-report-${month}.csv\"`,
          'Content-Type': 'text/csv; charset=utf-8',
        },
        status: 200,
      })
    }

    return Response.json(
      {
        summary: buildOrdersReportSummary({ month, orders }),
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ message }, { status: 500 })
  }
}
