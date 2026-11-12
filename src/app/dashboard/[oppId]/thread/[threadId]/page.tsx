import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { ChatInterface } from '@/components/v2/ChatInterface'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { getDynamicApiPlatforms } from '@/lib/integrations'
import { findEmailBlock } from '@/lib/emailBlock'

// "All platforms" templates cover messaging platforms
const MESSAGING = ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn']

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i

export default async function Page({ params }: { params: Promise<{ oppId: string; threadId: string }> }) {
  const { oppId, threadId } = await params
  if (!UUID.test(oppId) || !UUID.test(threadId)) notFound()
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const { data: thread } = await supabase
    .from('threads')
    .select('*, messages (*), drafts (*), opportunities (*, businesses (*))')
    .eq('id', threadId)
    .eq('opportunity_id', oppId)
    .maybeSingle()
  if (!thread || !thread.opportunities?.businesses) notFound()

  const opp = thread.opportunities
  // Meta approves templates on its side: re-check any that are in review or out of date first
  if (thread.platform === 'WhatsApp') {
    await import('@/lib/metaTemplates').then(m => m.refreshMetaTemplateStatuses()).catch(() => {})
  }
  const [{ data: siblings }, { data: templates }, { data: people }, emailBlock, apiPlatforms, waConfig, { data: metaRows }] = await Promise.all([
    supabase.from('threads').select('id, platform, status').eq('opportunity_id', oppId),
    supabase.from('templates').select('id, name, platform, step, services, business_types, subject, body, whatsapp_template_name').in('platform', MESSAGING.includes(thread.platform) ? [thread.platform, 'All'] : [thread.platform]).eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name'),
    thread.platform === 'Email' ? findEmailBlock(supabase, opp.businesses?.email) : Promise.resolve(null),
    getDynamicApiPlatforms(),
    import('@/lib/integrations').then(m => m.getWhatsAppConfig()).catch(() => null),
    // This product's Meta templates and their review status (WhatsApp only)
    thread.platform === 'WhatsApp'
      ? supabase.from('meta_templates').select('name, status').eq('managed', true)
      : Promise.resolve({ data: [] as { name: string; status: string }[] }),
  ])
  let activeMetaRows = metaRows || []
  if (thread.platform === 'WhatsApp' && activeMetaRows.some(m => m.status === 'PENDING')) {
    try {
      const { syncMetaTemplates } = await import('@/app/dashboard/templates/metaActions')
      await syncMetaTemplates()
      const { data: refreshed } = await supabase.from('meta_templates').select('name, status').eq('managed', true)
      if (refreshed) activeMetaRows = refreshed
    } catch {
      // Fallback to activeMetaRows
    }
  }

  // One status per Meta template name; Approved wins when it exists in any language
  const metaStatuses: Record<string, string> = {}
  for (const m of activeMetaRows) if (metaStatuses[m.name] !== 'APPROVED') metaStatuses[m.name] = m.status

  const type = opp.businesses?.business_type

  // Most specific first: business type + platform > business type + All > General + platform > General + All
  const score = (t: { platform: string; business_types?: string[] }) =>
    (type && t.business_types?.includes(type) ? 0 : 2) + (t.platform === thread.platform ? 0 : 1)
  const fitting = (templates || [])
    .filter(t => !t.business_types?.length || (type && t.business_types.includes(type)))
    .sort((a, z) => score(a) - score(z))
  const messages = [...(thread.messages || [])].sort((a, z) => (a.created_at < z.created_at ? -1 : 1))
  const draft = [...(thread.drafts || [])].filter(d => (d.status === 'ready' || d.status === 'needs_data') && (thread.status !== 'Replied' || d.step_label === 'Reply')).sort((a, z) => (a.created_at < z.created_at ? 1 : -1))[0] || null
  const sender = people?.find(p => p.id === (opp.assigned_sales_id || profile.id))?.full_name || profile.full_name

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Lead Management', href: '/dashboard/leads' },
          ...(type ? [{ label: type, href: `/dashboard/leads?type=${encodeURIComponent(type)}` }] : []),
          { label: opp.businesses?.business_name || 'Business', href: `/dashboard/${oppId}` },
          { label: thread.platform },
        ]}
      />
      <ChatInterface
        thread={{ ...thread, messages, opportunities: undefined }}
        opp={opp}
        draft={draft}
        templates={fitting}
        siblings={siblings || []}
        people={people || []}
        me={profile}
        senderName={sender}
        apiPlatforms={apiPlatforms}
        humanAgent={process.env.META_HUMAN_AGENT === 'true'}
        emailBlock={emailBlock}
        defaultWhatsAppTemplate={waConfig?.default_template_name}
        metaStatuses={metaStatuses}
      />
    </>
  )
}
