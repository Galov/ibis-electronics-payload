import clsx from 'clsx'
import React from 'react'

/* [
          classes.message,
          className,
          error && classes.error,
          success && classes.success,
          warning && classes.warning,
          !error && !success && !warning && classes.default,
        ]
          .filter(Boolean)
          .join(' '), */

export const Message: React.FC<{
  className?: string
  error?: React.ReactNode
  message?: React.ReactNode
  success?: React.ReactNode
  warning?: React.ReactNode
}> = ({ className, error, message, success, warning }) => {
  const messageToRender = message || error || success || warning

  if (messageToRender) {
    return (
      <div
        className={clsx(
          'my-8 px-4 py-3 text-sm leading-6',
          {
            'bg-emerald-100 text-emerald-900': Boolean(success),
            'bg-amber-100 text-amber-900': Boolean(warning),
            'bg-red-100 text-red-900': Boolean(error),
            'bg-muted/30 text-primary/70': !error && !success && !warning,
          },
          className,
        )}
      >
        {messageToRender}
      </div>
    )
  }
  return null
}
