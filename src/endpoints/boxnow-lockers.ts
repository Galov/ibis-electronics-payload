import type { PayloadHandler } from 'payload'

import { loadBoxNowLockers } from '@/utilities/boxNow'

const jsonError = (message: string, status: number) =>
  Response.json(
    {
      message,
    },
    { status },
  )

export const boxNowLockersHandler: PayloadHandler = async () => {
  try {
    const lockers = await loadBoxNowLockers()
    return Response.json({ lockers }, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Възникна проблем при заявката към BoxNow.'
    return jsonError(message, 500)
  }
}
