import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { ClientsView, type ClientRow } from '@/components/customers/ClientsView'
import { EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

// Client Audience: the client businesses whose customers we market to
export default async function CustomerLeadsPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (profile.role !== 'admin' && profile.role !== 'sales') {
    return <EmptyState title="Client Audience is for the admin and sales team" text="Ask an admin if you need access." />
  }

  const { data: counts } = await supabase
    .from('customer_lead_counts')
    .select('business_id, total, ready, missing, do_not_contact, whatsapp, test, last_added_at')
    .order('last_added_at', { ascending: false })
  const ids = (counts || []).map(c => c.business_id)
  // Read-only: names come from Lead Management
  const { data: businesses } = ids.length
    ? await supabase.from('businesses').select('id, business_name, contact_name, business_type, area').in('id', ids)
    : { data: [] }
  const byId = new Map((businesses || []).map(b => [b.id, b]))

  const clients: ClientRow[] = (counts || []).flatMap(c => {
    const b = byId.get(c.business_id)
    return b ? [{ ...c, ...b }] : []
  })

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Client Audience' }]} />
      <ClientsView clients={clients} />
    </>
  )
}
