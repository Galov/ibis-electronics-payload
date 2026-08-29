import type { PayloadHandler } from 'payload'

import { checkRole } from '@/access/utilities'
import {
  buildCatalogSyncFingerprints,
  enqueueCatalogContentSync,
  loadCatalogSyncProductForUser,
} from '@/services/catalogSync'

const unauthorized = () => Response.json({ message: 'Unauthorized' }, { status: 401 })

const productID = (req: Parameters<PayloadHandler>[0]) => {
  const id = req.routeParams?.id
  return typeof id === 'string' && id ? id : null
}

const findLatestOutbox = async (req: Parameters<PayloadHandler>[0], id: string) => {
  const result = await req.payload.find({
    collection: 'catalog-sync-outbox',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    sort: '-createdAt',
    where: { product: { equals: id } },
  })
  return result.docs[0] || null
}

const safeStatus = async (req: Parameters<PayloadHandler>[0], id: string) => {
  const product = await loadCatalogSyncProductForUser({ productId: id, req })
  const fingerprints = buildCatalogSyncFingerprints(product)
  const state = product.catalogSync || {}
  const latest = await findLatestOutbox(req, id)
  const approved = state.approved === true

  return {
    approved,
    approvalStatus: state.approvalStatus || 'never_sent',
    commerceStatus:
      approved && fingerprints.commerce !== state.lastCommerceFingerprint
        ? state.commerceStatus === 'error'
          ? 'error'
          : 'pending'
        : state.commerceStatus || 'current',
    contentStatus:
      approved && fingerprints.content !== state.lastContentFingerprint
        ? 'changed'
        : state.contentStatus || 'current',
    commerceLastError: state.commerceLastError || null,
    contentLastError: state.contentLastError || state.lastError || null,
    lastError:
      state.commerceLastError ||
      state.contentLastError ||
      state.lastError ||
      latest?.lastError ||
      null,
    lastSuccessfulAt: state.lastSuccessfulAt || null,
    lastSuccessfulEventId: state.lastSuccessfulEventId || null,
    latest: latest
      ? {
          action: latest.action,
          attempts: latest.attempts,
          eventId: latest.eventId || null,
          status: latest.status,
        }
      : null,
  }
}

export const catalogSyncAdminStatusHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) return unauthorized()
  const id = productID(req)
  if (!id) return Response.json({ message: 'Липсва ID на продукт.' }, { status: 400 })

  try {
    return Response.json(await safeStatus(req, id))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Статусът не може да бъде зареден.'
    return Response.json({ message }, { status: 400 })
  }
}

export const catalogSyncAdminSendHandler: PayloadHandler = async (req) => {
  if (!req.user || !checkRole(['admin'], req.user)) return unauthorized()
  const id = productID(req)
  if (!id) return Response.json({ message: 'Липсва ID на продукт.' }, { status: 400 })

  try {
    const product = await loadCatalogSyncProductForUser({ productId: id, req })
    const result = await enqueueCatalogContentSync({ product, req })
    return Response.json(
      {
        ...(await safeStatus(req, id)),
        message: result.reused
          ? 'Същото съдържание вече чака обработка.'
          : 'Продуктът е добавен в опашката за румънския сайт.',
      },
      { status: 202 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Продуктът не може да бъде изпратен.'
    return Response.json({ message }, { status: 400 })
  }
}
