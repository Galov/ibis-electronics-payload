import { createLocalReq, type PayloadRequest, type RequiredDataFromCollectionSlug } from 'payload'

export async function createCheckoutOrderOnce(
  req: PayloadRequest,
  transactionId: string,
  data: RequiredDataFromCollectionSlug<'orders'>,
) {
  const outerTransaction = req.transactionID
  const existing = async (readReq = req) =>
    (
      await req.payload.find({
        collection: 'orders',
        where: { checkoutTransactionId: { equals: transactionId } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req: readReq,
      })
    ).docs[0]
  const prior = await existing()
  if (prior) return prior
  try {
    return await req.payload.create({
      collection: 'orders',
      data: { ...data, checkoutTransactionId: transactionId },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    // The sparse unique index arbitrates simultaneous browser/webhook confirmations.
    // An existing outer transaction cannot safely be reused after a duplicate-key error.
    if (outerTransaction) throw error
    const winner = await existing(await createLocalReq({}, req.payload))
    if (winner) {
      delete req.transactionID
      return winner
    }
    throw error
  }
}
