import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { InsightsView, type InsightsData } from '@/components/v2/InsightsView'
import { todayLondon } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Search = { from?: string; to?: string; service?: string; user?: string }
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  // Default: last 30 days (today included)
  const today = todayLondon()
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 29)
  const from = isDate(sp.from) ? sp.from! : d.toISOString().slice(0, 10)
  const to = isDate(sp.to) ? sp.to! : today
  const isAdmin = profile.role === 'admin'

  const [{ data, error }, { data: staff }] = await Promise.all([
    supabase.rpc('insights', {
      p_from: from,
      p_to: to,
      p_service: sp.service || null,
      p_user: isAdmin ? sp.user || null : null,
    }),
    isAdmin
      ? supabase.from('profiles').select('id, full_name, role').eq('is_active', true).neq('role', 'admin').order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string; role: string }[] }),
  ])

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Insights' }]} />
      <InsightsView
        data={(data as InsightsData) ?? null}
        loadError={error?.message ?? null}
        params={{ from, to, service: sp.service || '', user: sp.user || '' }}
        isAdmin={isAdmin}
        staff={staff || []}
      />
    </>
  )
}
