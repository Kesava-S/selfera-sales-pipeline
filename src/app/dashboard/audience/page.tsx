import { requireProfile } from '@/lib/auth'
import { actsAsSales } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { ClientsView, type ClientRow } from '@/components/customers/ClientsView'
import { EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

// Client Audience: the client businesses whose customers we market to
export default async function CustomerLeadsPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (profile.role !== 'admin' && !actsAsSales(profile.role)) {
    return <EmptyState title="Client Audience is for the admin and sales team" text="Ask an admin if you need access." />
  }

  // Clients = businesses with customers, plus clients added when their lead was Won (migration 72)
  const [{ data: counts }, { data: saved }] = await Promise.all([
    supabase
      .from('customer_lead_counts')
      .select('business_id, total, ready, missing, do_not_contact, whatsapp, test, last_added_at')
      .order('last_added_at', { ascending: false }),
    supabase.from('audience_clients').select('business_id, source, added_at'),
  ])
  const savedById = new Map((saved || []).map(s => [s.business_id, s]))
  const empty = { total: 0, ready: 0, missing: 0, do_not_contact: 0, whatsapp: 0, test: 0, last_added_at: null }
  const allCounts = [
    ...(counts || []),
    ...(saved || []).filter(s => !(counts || []).some(c => c.business_id === s.business_id)).map(s => ({ ...empty, business_id: s.business_id })),
  ]
  const ids = allCounts.map(c => c.business_id)
  // Read-only: names come from Lead Management
  const { data: businesses } = ids.length
    ? await supabase.from('businesses').select('id, business_name, contact_name, business_type, area').in('id', ids)
    : { data: [] }
  const byId = new Map((businesses || []).map(b => [b.id, b]))

  // Won leads only (a client whose lead was reopened drops off until it's Won again)
  const { data: wonRows } = ids.length
    ? await supabase.from('opportunities').select('business_id').eq('stage', 'Won').in('business_id', ids)
    : { data: [] as { business_id: string }[] }
  const wonIds = new Set((wonRows || []).map(r => r.business_id))

  const clients: ClientRow[] = allCounts.filter(c => wonIds.has(c.business_id)).flatMap(c => {
    const b = byId.get(c.business_id)
    const s = savedById.get(c.business_id)
    return b ? [{ ...c, ...b, source: s?.source ?? null, added_at: s?.added_at ?? null }] : []
  })
  // Newest activity first: last customer added, or when the client was added
  clients.sort((a, z) => ((z.last_added_at || z.added_at || '') > (a.last_added_at || a.added_at || '') ? 1 : -1))

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Client Audience' }]} />
      <ClientsView clients={clients} />
    </>
  )
}
