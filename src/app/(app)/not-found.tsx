import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <section className="container py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 inline-flex items-center gap-3 rounded-md border border-[rgb(1,55,186)]/12 bg-[rgb(1,55,186)]/6 px-4 py-2 text-sm text-[rgb(1,55,186)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[rgb(1,55,186)]" />
          <span>Грешка 404</span>
        </div>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)] lg:items-start">
          <div className="flex h-full flex-col">
            <h1 className="type-page-title max-w-3xl text-primary">
              Тази страница не съществува или адресът вече е променен.
            </h1>

            <p className="type-body mt-5 max-w-2xl text-primary/65 md:text-lg">
              Възможно е линкът да е остарял, страницата да е преместена или адресът да е
              въведен неточно. Най-бързият път е да продължите към каталога и да намерите
              търсения продукт оттам.
            </p>

            <div className="mt-12 flex flex-wrap gap-4 lg:mt-auto">
              <Button
                asChild
                className="h-12 rounded-md border-[rgb(1,55,186)] bg-[rgb(1,55,186)] px-9 text-sm font-normal text-white hover:bg-[rgb(1,55,186)] hover:text-white"
              >
                <Link href="/shop">Към каталога</Link>
              </Button>

              <Button asChild className="h-12 rounded-md px-7 text-sm font-normal" variant="outline">
                <Link href="/contact">Контакт</Link>
              </Button>
            </div>
          </div>

          <aside className="rounded-md border border-black/6 bg-[rgb(248,250,252)] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <p className="type-eyebrow text-primary/45">Полезни страници</p>

            <div className="mt-6 space-y-5">
              <Link
                className="group block border-b border-black/6 pb-5 last:border-b-0 last:pb-0"
                href="/shop"
              >
                <p className="type-subsection-title text-primary transition group-hover:text-[rgb(1,55,186)]">
                  Каталог
                </p>
                <p className="type-body-small mt-1 text-primary/60">
                  Разгледайте всички налични продукти и филтрирайте по категория или марка.
                </p>
              </Link>

              <Link
                className="group block border-b border-black/6 pb-5 last:border-b-0 last:pb-0"
                href="/partners"
              >
                <p className="type-subsection-title text-primary transition group-hover:text-[rgb(1,55,186)]">
                  Партньори
                </p>
                <p className="type-body-small mt-1 text-primary/60">
                  Намерете най-близкия партньорски обект на Ibis Electronics.
                </p>
              </Link>

              <Link className="group block" href="/contact">
                <p className="type-subsection-title text-primary transition group-hover:text-[rgb(1,55,186)]">
                  Контакт
                </p>
                <p className="type-body-small mt-1 text-primary/60">
                  Вижте адресите на магазина и склада или ни изпратете запитване.
                </p>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
