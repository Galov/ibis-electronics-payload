import Page from '@/app/(app)/(account)/orders/[id]/page'
export default Page
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return {
    title: 'Order',
    alternates: { canonical: `/en/orders/${encodeURIComponent(id)}` },
    referrer: 'no-referrer' as const,
  }
}
