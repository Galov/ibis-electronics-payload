'use client'

import { Toaster } from 'sonner'

export const SonnerProvider = ({ children }: { children?: React.ReactNode }) => {
  return (
    <>
      {children}

      <Toaster richColors position="bottom-left" theme="light" />
    </>
  )
}
