import type { GlobalAfterChangeHook } from 'payload'
import { revalidateTag } from 'next/cache'

export const revalidateGlobal: GlobalAfterChangeHook = ({ global, req: { context } }) => {
  if (context.disableRevalidate) {
    return
  }

  revalidateTag(`global_${global.slug}`)
}
