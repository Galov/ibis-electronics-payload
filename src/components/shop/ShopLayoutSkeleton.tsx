import React from 'react'

const shimmer = 'shop-skeleton relative overflow-hidden rounded-[10px] bg-[rgb(237,242,250)]'

function Line({
  className,
}: {
  className?: string
}) {
  return <div className={`${shimmer} h-4 ${className || ''}`.trim()} />
}

export function ShopLayoutSkeleton() {
  return (
    <div className="container my-16 flex flex-col gap-8 pb-4" aria-hidden="true">
      <div className={`${shimmer} h-[260px] w-full rounded-[14px] md:h-[320px]`} />

      <div className="flex flex-col items-start gap-10 md:flex-row md:gap-4">
        <aside className="hidden w-full basis-1/5 flex-none flex-col gap-4 md:flex">
          <div className="rounded-[12px] border border-[rgb(1,55,186)]/10 bg-[rgb(250,251,253)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.03)]">
            <div className="mb-5 flex items-center justify-between">
              <div className={`${shimmer} h-5 w-28`} />
              <div className={`${shimmer} h-5 w-5 rounded-full`} />
            </div>

            <div className="space-y-4">
              <Line className="w-3/4" />
              <Line className="w-5/6" />
              <Line className="w-2/3" />
              <Line className="w-4/5" />
              <Line className="w-3/5" />
              <Line className="w-5/6" />
              <Line className="w-2/3" />
            </div>
          </div>
        </aside>

        <div className="min-h-screen w-full">
          <section className="mb-6 rounded-[6px] bg-[rgb(250,251,253)] px-4 py-5 md:px-5 md:py-6">
            <div className="hidden md:block">
              <div className={`${shimmer} h-14 w-full rounded-[12px]`} />
            </div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="space-y-3">
                <Line className="w-40" />
                <Line className="w-56" />
              </div>
              <div className="hidden md:flex gap-3">
                <div className={`${shimmer} h-10 w-36 rounded-[8px]`} />
                <div className={`${shimmer} h-10 w-28 rounded-[8px]`} />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[12px] border border-[rgb(1,55,186)]/8 bg-white p-4 shadow-[0_12px_26px_rgba(15,23,42,0.04)]"
              >
                <div className={`${shimmer} mb-4 aspect-square w-full rounded-[10px]`} />
                <Line className="mb-3 w-5/6" />
                <Line className="mb-3 w-2/3" />
                <Line className="mb-5 w-1/2" />
                <div className="flex items-center justify-between gap-3">
                  <div className={`${shimmer} h-6 w-20 rounded-[8px]`} />
                  <div className={`${shimmer} h-10 w-28 rounded-[999px]`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
