import { cn } from '@/utilities/cn'
import React from 'react'
import type { DefaultDocumentIDType } from 'payload'

type InfoStepsBlockProps = {
  description?: string | null
  eyebrow?: string | null
  items?:
    | Array<{
        description?: string | null
        id?: null | string
        summary?: string | null
        title?: string | null
      }>
    | null
  title?: string | null
}

export const InfoStepsBlock: React.FC<
  InfoStepsBlockProps & {
    className?: string
    id?: DefaultDocumentIDType
  }
> = ({ className, description, eyebrow, items, title }) => {
  if (!items?.length) return null

  return (
    <section className={cn('container', className)}>
      <div className="grid gap-8 rounded-[24px] bg-[rgb(1,55,186)] px-5 py-8 text-white md:grid-cols-[0.9fr_1.1fr] md:px-7 md:py-10">
        <div className="max-w-xl">
          {eyebrow ? <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-white/70">{eyebrow}</p> : null}
          {title ? <h2 className="text-3xl font-normal tracking-[-0.03em] text-white">{title}</h2> : null}
          {description ? <p className="mt-4 text-sm leading-7 text-white/78 md:text-base">{description}</p> : null}
        </div>

        <div className="grid gap-4">
          {items.map((item, index) => (
            <article
              className="rounded-[18px] border border-white/12 bg-white/8 p-5 backdrop-blur-sm"
              key={item.id || `${item.title || 'step'}-${index}`}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-medium text-[rgb(1,55,186)]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-xl font-normal tracking-[-0.02em] text-white">{item.title}</h3>
              </div>

              {item.summary ? <p className="text-sm font-medium uppercase tracking-[0.08em] text-white/72">{item.summary}</p> : null}
              {item.description ? <p className="mt-3 text-sm leading-7 text-white/84">{item.description}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
