import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { STATUS_PAGES } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { LiveRefresh } from '@/components/LiveRefresh'
import { StatusTypeBoxes } from '@/components/v2/DrilldownViews'
import { OffTargetLeads, type OffTargetRow } from '@/components/v2/OffTargetLeads'
import { ErrorNote, InfoTip } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function StatusPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  const def = STATUS_PAGES[key]
  if (!def) notFound()

  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (def.adminOnly && profile.role !== 'admin') notFound()

  // Leads staff marked off-target (no type step)
  if (key === 'off-target-leads') {
    const { data, error } = await supabase.rpc('list_off_target_leads')
    return (
      <div className="space-y-5">
        <LiveRefresh name="status" />
        <BreadcrumbSetter
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Off-target leads' },
          ]}
        />
        <div>
          <h1 className="flex items-center gap-2">
            Off-target leads
            <InfoTip align="left" text="Reached during outreach or campaigns but unrelated to us, or found not to fit later. Marked by staff; left out of the pipeline, Due today and new campaigns." />
          </h1>
        </div>
        <ErrorNote error={error?.message} />
        <OffTargetLeads rows={(data || []) as OffTargetRow[]} />
      </div>
    )
  }

  // Every other status box follows: status > business type > list > open
  const { data, error } = await supabase.rpc('status_type_counts', {
    p_status: key,
  })

  return (
    <div className="space-y-6">
      <LiveRefresh name="status" />
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: def.label },
        ]}
      />
      <ErrorNote error={error?.message} />
      <StatusTypeBoxes
        statusKey={key}
        statusLabel={def.label}
        counts={data || []}
      />
    </div>
  )
}
