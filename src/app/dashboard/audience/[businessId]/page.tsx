import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { actsAsSales } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { CustomersView, type CustomerFilters, type CustomerTab } from '@/components/customers/CustomersView'
import { EmptyState } from '@/components/ui'
import type { CustomerLead } from '@/lib/customerLeads'
import { AudienceCampaigns, type AudienceCampaignRow } from '@/components/customers/AudienceCampaigns'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i
const PAGE_SIZE = 50
const TABS: CustomerTab[] = ['all', 'ready', 'missing', 'dnc']

export default async function ClientCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { businessId } = await params
  if (!UUID.test(businessId)) notFound()
  const sp = await searchParams
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (profile.role !== 'admin' && !actsAsSales(profile.role)) {
    return <EmptyState title="Client Audience is for the admin and sales team" text="Ask an admin if you need access." />
  }

  // Read-only: the client comes from Lead Management
  const { data: business } = await supabase
    .from('businesses')
    .select('id, business_name, contact_name, business_type, area, email, phone, whatsapp_number')
    .eq('id', businessId)
    .maybeSingle()
  if (!business) notFound()

  // Client Audience is only for Won leads. A client that stops being Won keeps its
  // customers (read-only use; campaigns pause), but a business never Won has no page here.
  const [{ count: wonNow }, { count: customerCount }] = await Promise.all([
    supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('stage', 'Won'),
    supabase.from('customer_leads').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
  ])
  if (!wonNow && !customerCount) {
    return (
      <EmptyState
        title="Only Won leads can be Client Audience clients"
        text={`${business.business_name} isn't Won in Lead Management yet. Once it's marked Won, it's added here automatically.`}
      >
        <Link href="/dashboard/audience" className="btn btn-secondary">Back to Client Audience</Link>
      </EmptyState>
    )
  }

  const filters: CustomerFilters = {
    tab: TABS.includes(sp.tab as CustomerTab) ? (sp.tab as CustomerTab) : 'all',
    q: sp.q?.trim() || '',
    phone: ['mobile', 'landline', 'invalid', 'none'].includes(sp.phone || '') ? sp.phone! : '',
    country: sp.country === 'UK' || sp.country === 'India' ? sp.country : '',
  }
  const page = Math.max(1, Number(sp.page) || 1)

  let list = supabase.from('customer_leads').select('*', { count: 'exact' }).eq('business_id', businessId)
  if (filters.tab === 'dnc') list = list.eq('do_not_contact', true)
  else {
    list = list.eq('do_not_contact', false)
    if (filters.tab === 'ready') list = list.eq('is_ready', true)
    if (filters.tab === 'missing') list = list.eq('is_ready', false)
  }
  if (filters.q) {
    const q = filters.q.replace(/[%_,()\\*]/g, ' ').trim()
    if (q) list = list.or(['first_name', 'last_name', 'email', 'phone', 'phone2', 'phone_e164', 'town', 'postcode'].map(c => `${c}.ilike.%${q}%`).join(','))
  }
  if (filters.phone === 'none') list = list.is('phone', null).is('phone2', null)
  else if (filters.phone) list = list.or(`phone_type.eq.${filters.phone},phone2_type.eq.${filters.phone}`)
  if (filters.country) list = list.eq('country', filters.country)

  const view = sp.view === 'campaigns' ? 'campaigns' : 'customers'
  const [{ data: customers, count }, { data: counts }, { data: client }, { count: won }, { data: batches }, emailCamps, waCamps, { data: tagRows }] = await Promise.all([
    view === 'customers'
      ? list.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      : Promise.resolve({ data: [], count: 0 }),
    supabase.from('customer_lead_counts').select('total, ready, missing, do_not_contact, whatsapp, test').eq('business_id', businessId).maybeSingle(),
    supabase.from('audience_clients').select('dpa_signed_on, sender_name, reply_to').eq('business_id', businessId).maybeSingle(),
    // Read-only: campaigns unlock while the business is Won in Lead Management
    supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('stage', 'Won'),
    supabase.from('customer_import_batches').select('id, file_name, created_count, created_at, approved_at, created_by').eq('business_id', businessId).is('approved_at', null).order('created_at'),
    view === 'campaigns'
      ? supabase.from('email_campaigns').select('id, name, subject, status, recipient_count, created_at, sent_at').eq('audience_business_id', businessId)
      : Promise.resolve({ data: [] }),
    view === 'campaigns'
      ? supabase.from('whatsapp_campaigns').select('id, name, status, recipient_count, created_at, sent_at').eq('audience_business_id', businessId)
      : Promise.resolve({ data: [] }),
    view === 'campaigns'
      ? supabase.from('customer_leads').select('tags').eq('business_id', businessId).neq('tags', '{}').limit(5000)
      : Promise.resolve({ data: [] }),
  ])
  const campaigns: AudienceCampaignRow[] = [
    ...(emailCamps.data || []).map(c => ({ ...c, channel: 'email' as const })),
    ...(waCamps.data || []).map(c => ({ ...c, subject: null, channel: 'whatsapp' as const })),
  ].sort((a, z) => (a.created_at < z.created_at ? 1 : -1))
  const tags = [...new Set((tagRows || []).flatMap(r => (r as { tags: string[] }).tags))].sort((a, z) => a.localeCompare(z))
  const settings = { dpaSignedOn: client?.dpa_signed_on ?? null, senderName: client?.sender_name ?? '', replyTo: client?.reply_to ?? '' }

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Client Audience', href: '/dashboard/audience' },
          { label: business.business_name },
        ]}
      />
      <CustomersView
        business={business}
        customers={(customers || []) as CustomerLead[]}
        total={count ?? 0}
        counts={counts ?? { total: 0, ready: 0, missing: 0, do_not_contact: 0, whatsapp: 0, test: 0 }}
        filters={filters}
        page={page}
        pageSize={PAGE_SIZE}
        view={view}
        isAdmin={profile.role === 'admin'}
        meId={profile.id}
        pendingImports={batches || []}
      >
        {view === 'campaigns' && (
          <AudienceCampaigns
            business={business}
            isAdmin={profile.role === 'admin'}
            won={(won ?? 0) > 0}
            settings={settings}
            campaigns={campaigns}
            tags={tags}
          />
        )}
      </CustomersView>
    </>
  )
}
