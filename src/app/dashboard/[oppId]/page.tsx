import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BusinessDetail } from '@/components/v2/BusinessDetail'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

export const dynamic = 'force-dynamic'

export default async function Page({
  params
}: {
  params: Promise<{ oppId: string }>
}) {
  const { oppId } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch opportunity + business + threads + latest draft for each thread
  const { data: opp, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      businesses (*),
      threads (
        *,
        drafts (
          id,
          step_label,
          status,
          due_on
        )
      ),
      stage_changes (
        from_stage,
        to_stage,
        reason,
        created_at
      )
    `)
    .eq('id', oppId)
    .single()

  if (error || !opp) return notFound()

  // Sort stage changes descending
  if (opp.stage_changes) {
    opp.stage_changes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  const service = opp.services_pitched?.[0] || 'Service'
  const type = opp.businesses?.business_type || 'Type'
  
  return (
    <>
      <BreadcrumbSetter breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: service, href: `/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}` },
        { label: type, href: `/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}` },
        { label: opp.businesses?.business_name || 'Business' }
      ]} />
      <BusinessDetail opp={opp} />
    </>
  )
}
