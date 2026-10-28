import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { SettingsView, type OptOut } from '@/components/v2/SettingsView'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  const isAdmin = profile.role === 'admin'

  let cadence: { step_name: string; days_delay: number }[] = []
  let optOuts: OptOut[] = []

  if (isAdmin) {
    const [{ data: rules }, { data: blocked }] = await Promise.all([
      supabase.from('cadence_rules').select('step_name, days_delay'),
      supabase.from('opt_outs').select('id, identifier, channel, reason, source, created_at').order('created_at', { ascending: false }).limit(500),
    ])
    cadence = rules || []

    // Name the business behind each blocked address, where we know it
    const emails = [...new Set((blocked || []).map(o => o.identifier.toLowerCase()).filter(x => x.includes('@')))]
    const names = new Map<string, string>()
    if (emails.length) {
      const { data: biz } = await supabase.from('businesses').select('business_name, email').in('email', emails)
      biz?.forEach(b => b.email && names.set(b.email.toLowerCase(), b.business_name))
    }
    optOuts = (blocked || []).map(o => ({
      id: o.id, identifier: o.identifier, channel: o.channel, reason: o.reason, source: o.source,
      createdAt: o.created_at, business: names.get(o.identifier.toLowerCase()) ?? null,
    }))
  }

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />
      <SettingsView me={profile} isAdmin={isAdmin} cadence={cadence} optOuts={optOuts} />
    </>
  )
}
