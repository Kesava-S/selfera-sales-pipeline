import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { BusinessDetail } from '@/components/v2/BusinessDetail'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i

export default async function Page({ params }: { params: Promise<{ oppId: string }> }) {
  const { oppId } = await params
  if (!UUID.test(oppId)) notFound()
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const { data: opp } = await supabase
    .from('opportunities')
    .select(`*, businesses (*), threads (*, drafts (id, step_label, status)), stage_changes (id, from_stage, to_stage, from_services, to_services, reason, changed_by, created_at), notes (id, body, created_by, created_at)`)
    .eq('id', oppId)
    .maybeSingle()
  if (!opp) notFound()

  const [{ data: others }, { data: people }] = await Promise.all([
    supabase.from('opportunities').select('id, services_pitched, stage, created_at').eq('business_id', opp.business_id).neq('id', oppId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role, is_active'),
  ])

  const service = opp.services_pitched?.[0]
  const type = opp.businesses?.business_type
  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          ...(service ? [{ label: service, href: `/dashboard/service/${encodeURIComponent(service)}` }] : []),
          ...(service && type ? [{ label: type, href: `/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}` }] : []),
          { label: opp.businesses?.business_name || 'Business' },
        ]}
      />
      <BusinessDetail opp={opp} otherPitches={others || []} people={people || []} me={profile} />
    </>
  )
}
