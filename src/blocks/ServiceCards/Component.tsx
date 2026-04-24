import { cn } from '@/utilities/cn'
import React from 'react'
import type { DefaultDocumentIDType } from 'payload'

type ServiceCardsBlockProps = {
  description?: string | null
  eyebrow?: string | null
  items?:
    | Array<{
        description?: string | null
        highlights?: Array<{
          id?: null | string
          text?: null | string
        }> | null
        id?: null | string
        tags?: Array<{
          id?: null | string
          label?: null | string
        }> | null
        title?: string | null
      }>
    | null
  title?: string | null
}

export const ServiceCardsBlock: React.FC<
  ServiceCardsBlockProps & {
    className?: string
    id?: DefaultDocumentIDType
  }
> = ({ className, description, eyebrow, items, title }) => {
  if (!items?.length) return null

  return (
    <section className={cn('container', className)}>
      <div className="rounded-[24px] bg-muted/20 px-5 py-8 md:px-7 md:py-10">
        <div className="mb-8 max-w-3xl md:mb-10">
          {eyebrow ? (
            <p className="type-eyebrow mb-3 text-[rgb(1,55,186)]/72">{eyebrow}</p>
          ) : null}
          {title ? <h2 className="type-page-title text-primary/90">{title}</h2> : null}
          {description ? <p className="type-body-small mt-4 text-primary/65 md:text-base">{description}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <article
              className="rounded-[20px] border border-black/6 bg-white p-5 shadow-[0_14px_34px_rgba(17,24,39,0.06)]"
              key={item.id || `${item.title || 'item'}-${index}`}
            >
              <h3 className="type-card-title text-primary/90">{item.title}</h3>
              {item.description ? <p className="type-body-small mt-3 text-primary/65">{item.description}</p> : null}

              {item.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag, tagIndex) =>
                    tag.label ? (
                      <span
                        className="type-eyebrow rounded-full bg-[rgb(1,55,186)]/7 px-3 py-1 text-[rgb(1,55,186)]"
                        key={tag.id || `${tag.label}-${tagIndex}`}
                      >
                        {tag.label}
                      </span>
                    ) : null,
                  )}
                </div>
              ) : null}

              {item.highlights?.length ? (
                <ul className="mt-5 space-y-3">
                  {item.highlights.map((highlight, highlightIndex) =>
                    highlight.text ? (
                      <li
                        className="type-body-small flex items-start gap-3 text-primary/72"
                        key={highlight.id || `${highlight.text}-${highlightIndex}`}
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(1,55,186)]/75" />
                        <span>{highlight.text}</span>
                      </li>
                    ) : null,
                  )}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
