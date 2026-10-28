import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { CampaignRepliesView } from '@/components/v2/CampaignReplies'
import { EmptyState } from '@/components/ui'
import { REPLY_SELECT, type CampaignReply } from '@/lib/campaignReplies'

// One replies page per channel: /dashboard/campaigns/replies (email) and /dashboard/whatsapp-campaigns/replies
export async function RepliesPage({ channel, searchParams }: { channel: 'email' | 'whatsapp'; searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const { supabase, profile } = await requireProfile()
  if (!profile) return null
  if (profile.role !== 'admin' && profile.role !== 'sales') {
    return <EmptyState title="Campaign replies are for the admin and sales team" />
  }

  const filters = {
    status: ['new', 'in_leads', 'dismissed'].includes(sp.status || '') ? sp.status! : 'new',
    unmatched: sp.unmatched === '1',
  }

  let list = supabase.from('campaign_replies').select(REPLY_SELECT).eq('channel', channel).eq('status', filters.status)
  if (filters.unmatched) list = list.is('campaign_id', null).is('whatsapp_campaign_id', null)

  const count = (status: string, unmatched = false) => {
    let q = supabase.from('campaign_replies').select('id', { count: 'exact', head: true }).eq('channel', channel).eq('status', status)
    if (unmatched) q = q.is('campaign_id', null).is('whatsapp_campaign_id', null)
    return q
  }

  const [{ data: replies }, n, l, d, u] = await Promise.all([
    list.order('received_at', { ascending: false }).limit(200),
    count('new'), count('in_leads'), count('dismissed'), count('new', true),
  ])

  const section = channel === 'email'
    ? { label: 'Email Campaigns', href: '/dashboard/campaigns' }
    : { label: 'WhatsApp Campaigns', href: '/dashboard/whatsapp-campaigns' }

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, section, { label: 'Replies' }]} />
      <CampaignRepliesView
        channel={channel}
        replies={(replies || []) as unknown as CampaignReply[]}
        filters={filters}
        counts={{ new: n.count ?? 0, in_leads: l.count ?? 0, dismissed: d.count ?? 0, unmatched: u.count ?? 0 }}
      />
    </>
  )
}
