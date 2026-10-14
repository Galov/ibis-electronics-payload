import { GuestWithdrawalForm, OrderWithdrawal } from '@/components/OrderWithdrawal'
import { getNoIndexMetadata } from '@/utilities/getNoIndexMetadata'
import Link from 'next/link'

const pageMetadata = getNoIndexMetadata({
  path: '/otkaz-porachka',
  title: 'Отказ от поръчка',
  description: 'Форма за отказ от поръчка в Ибис Електроникс.',
})
export const metadata = Promise.resolve(pageMetadata).then((value) => ({
  ...value,
  referrer: 'no-referrer' as const,
}))
export default async function WithdrawalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return (
    <main className="container py-14">
      <div className="max-w-2xl space-y-6">
        <h1 className="type-page-title">Отказ от поръчка</h1>
        <p className="text-sm leading-6">
          Можете да заявите отказ и преди доставката. За получени стоки законовият срок по общото
          правило е 14 дни от получаването, при спазване на законовите изключения. Датата на отказа
          се записва при потвърждение; ако срокът наближава или срещнете проблем, изпратете отказа
          директно по имейл до Ибис Електроникс.
        </p>
        {token ? (
          <>
            <OrderWithdrawal token={token} />
            <Link className="underline" href="/otkaz-porachka">
              Поискай нов линк
            </Link>
          </>
        ) : (
          <GuestWithdrawalForm />
        )}
        <p className="text-sm">
          <Link className="underline" href="/contact">
            Свържи се с Ибис Електроникс
          </Link>{' '}
          ·{' '}
          <Link className="underline" href="/terms#return-costs">
            Условия за ползване
          </Link>
        </p>
      </div>
    </main>
  )
}
