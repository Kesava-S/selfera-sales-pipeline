import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { ChatInterface } from '@/components/v2/ChatInterface'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { parseApiPlatforms } from '@/lib/sending'

// "All platforms" templates cover messaging only, not Phone or Walk-in
const MESSAGING = ['WhatsApp', 'Instagram', 'Facebook', 'Email']

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
  if (!thread) notFound()

  const opp = thread.opportunities
  const [{ data: siblings }, { data: templates }, { data: people }] = await Promise.all([
    supabase.from('threads').select('id, platform, status').eq('opportunity_id', oppId),
    supabase.from('templates').select('id, name, platform, step, services, business_types, subject, body, whatsapp_template_name').in('platform', MESSAGING.includes(thread.platform) ? [thread.platform, 'All'] : [thread.platform]).eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name'),
  ])

  // Only the templates that fit this pitch (its services, or general ones),
  // most specific first: service + platform > service + All > General + platform > General + All
  const score = (t: { platform: string; services: string[] }) => (t.services?.length ? 0 : 2) + (t.platform === thread.platform ? 0 : 1)
  const fitting = (templates || [])
    .filter(t => !t.services?.length || t.services.some((s: string) => opp.services_pitched.includes(s)))
    .sort((a, z) => score(a) - score(z))
  const messages = [...(thread.messages || [])].sort((a, z) => (a.created_at < z.created_at ? -1 : 1))
  const draft = [...(thread.drafts || [])].filter(d => (d.status === 'ready' || d.status === 'needs_data') && (thread.status !== 'Replied' || d.step_label === 'Reply')).sort((a, z) => (a.created_at < z.created_at ? 1 : -1))[0] || null
  const sender = people?.find(p => p.id === (opp.assigned_sales_id || profile.id))?.full_name || profile.full_name

  const service = opp.services_pitched?.[0]
  const type = opp.businesses?.business_type
  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          ...(service ? [{ label: service, href: `/dashboard/service/${encodeURIComponent(service)}` }] : []),
          ...(service && type ? [{ label: type, href: `/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}` }] : []),
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
        apiPlatforms={parseApiPlatforms(process.env.SEND_API_PLATFORMS)}
        humanAgent={process.env.META_HUMAN_AGENT === 'true'}
      />
    </>
  )
}
