import type { PayloadHandler } from 'payload'

import { checkRole } from '@/access/utilities'
import {
  CatalogSyncError,
  getCatalogSyncProductStatus,
  loadCatalogSyncProductForUser,
  refreshCatalogSyncProductStatus,
  sendCatalogSyncProductForUser,
} from '@/services/catalogSync'

const unauthorized = () => Response.json({ message: 'Unauthorized' }, { status: 401 })

const productID = (req: Parameters<PayloadHandler>[0]) => {
  const id = req.routeParams?.id
  return typeof id === 'string' && id ? id : null
}

const responseStatus = (error: unknown) => {
  if (!(error instanceof CatalogSyncError)) return 500
  if (error.code === 'CATALOG_SYNC_SEND_DISABLED') return 503
  if (error.code === 'CATALOG_SYNC_API_KEY_MISSING') return 500
  if (error.code === 'CATALOG_SYNC_TIMEOUT') return 504
  if (
    error.code === 'CATALOG_SYNC_INVALID_PRODUCT' ||
    error.code === 'CATALOG_SYNC_RELATION_NOT_POPULATED' ||
    error.code === 'CATALOG_SYNC_MISSING_STORAGE_KEY'
  ) {
    return 400
  }
  return 502
}

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const catalogSyncAdminStatusHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) return unauthorized()
  const id = productID(req)
  if (!id) return Response.json({ message: 'Липсва ID на продукт.' }, { status: 400 })

  try {
    const product = await loadCatalogSyncProductForUser({ productId: id, req })
    const refreshed = await refreshCatalogSyncProductStatus({ product, req })
    return Response.json(getCatalogSyncProductStatus(refreshed))
  } catch (error) {
    return Response.json(
      { message: messageFromError(error, 'Статусът не може да бъде зареден.') },
      { status: responseStatus(error) },
    )
  }
}

export const catalogSyncAdminSendHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) return unauthorized()
  const id = productID(req)
  if (!id) return Response.json({ message: 'Липсва ID на продукт.' }, { status: 400 })

  try {
    const product = await loadCatalogSyncProductForUser({ productId: id, req })
    const { product: updated, response } = await sendCatalogSyncProductForUser({ product, req })
    const status = getCatalogSyncProductStatus(updated)
    if (response.status === 'failed') {
      return Response.json(
        { ...status, message: status.lastError || 'Румънската обработка завърши с грешка.' },
        { status: 502 },
      )
    }
    const completed = response.status === 'succeeded' || response.status === 'superseded'

    return Response.json(
      {
        ...status,
        message: completed
          ? 'Продуктът е обработен успешно от румънския сайт.'
          : 'Продуктът е приет от румънския сайт и се обработва.',
      },
      { status: completed ? 200 : 202 },
    )
  } catch (error) {
    return Response.json(
      { message: messageFromError(error, 'Продуктът не може да бъде изпратен.') },
      { status: responseStatus(error) },
    )
  }
}
