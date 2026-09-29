import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AddLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const resolved = await searchParams
  const company = resolved?.company ? `&company=${encodeURIComponent(resolved.company)}` : ''
  redirect(`/leads?add=true${company}`)
}
