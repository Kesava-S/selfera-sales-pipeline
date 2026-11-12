import { requireProfile, getDashboardStatusCounts } from '@/lib/auth'
import { DashboardHome } from '@/components/v2/DashboardHome'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { LiveRefresh } from '@/components/LiveRefresh'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { supabase, user, profile } = await requireProfile()
  if (!profile) return null

  const [status, newOutreach, followUps, replies] = await Promise.all([
    getDashboardStatusCounts(supabase, user.id),
    supabase.rpc('v_due_today', { p_tab: 'New outreach', p_limit: 60 }),
    supabase.rpc('v_due_today', { p_tab: 'Follow-ups', p_limit: 60 }),
    supabase.rpc('v_due_today', { p_tab: 'Replies', p_limit: 60 }),
  ])
  const loadError = [status, newOutreach, followUps, replies].find(r => r.error)?.error?.message ?? null

  // Reply types (sorted by word rules; labels only): replies waiting for an answer
  // and new campaign replies. Each user only sees their own (database rules).
  const replyThreadIds = (replies.data ?? []).map((r: { thread_id: string }) => r.thread_id)
  const [{ data: replyThreads }, { data: campaignReplies }] = await Promise.all([
    replyThreadIds.length
      ? supabase.from('threads').select('id, last_reply_intent').in('id', replyThreadIds)
      : Promise.resolve({ data: [] as { id: string; last_reply_intent: string | null }[] }),
    supabase.from('campaign_replies').select('intent').eq('status', 'new').limit(2000),
  ])
  const intentByThread = new Map((replyThreads ?? []).map(t => [t.id, t.last_reply_intent]))
  const replyTypes: Record<string, number> = {}
  for (const i of [...(replyThreads ?? []).map(t => t.last_reply_intent), ...(campaignReplies ?? []).map(c => c.intent)]) {
    if (i && i !== 'other') replyTypes[i] = (replyTypes[i] ?? 0) + 1
  }
  const repliesDue = (replies.data ?? []).map((r: { thread_id: string }) => ({ ...r, reply_intent: intentByThread.get(r.thread_id) ?? null }))

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard' }]} />
      <LiveRefresh name="dashboard" />
      <DashboardHome
        name={profile.full_name.split(' ')[0]}
        role={profile.role}
        counts={status.data?.[0] ?? {}}
        due={{ new: newOutreach.data ?? [], followups: followUps.data ?? [], replies: repliesDue }}
        replyTypes={replyTypes}
        loadError={loadError}
      />
    </>
  )
}
