import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, User, Mail, Calendar, Activity, MessageSquare } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const supabase = await createClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', resolvedParams.id)
    .single()

  if (error || !lead) {
    return <div>Lead not found</div>
  }

  const { data: activities } = await supabase
    .from('activity_log')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/leads" className="text-muted" style={{ display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 className="mb-0">{lead.business_name}</h1>
        <span className={`badge badge-stage-${lead.stage.replace(/\s+/g, '')} ml-auto`}>
          {lead.stage}
        </span>
      </div>

      <div className="grid grid-cols-3">
        {/* Left column: Details and Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h2 className="mb-4">Details</h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-muted">
                <Mail size={18} />
                <span className={lead.email ? 'text-foreground' : ''}>{lead.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-muted">
                <MessageSquare size={18} />
                <span className="text-foreground">{lead.channel}</span>
              </div>
              <div className="flex items-center gap-3 text-muted">
                <Activity size={18} />
                <span className="text-foreground">{lead.follow_up_count} follow ups sent</span>
              </div>
              <div className="flex items-center gap-3 text-muted">
                <Calendar size={18} />
                <span className="text-foreground">
                  Next: {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleDateString() : 'None'}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="mb-4">Actions</h2>
            <div className="flex flex-col gap-3">
              <form action={async () => {
                'use server'
                const supabase = await createClient()
                await supabase.rpc('record_outreach', { p_lead_id: lead.id, p_action: 'sent', p_details: 'Manual message sent' })
                redirect(`/leads/${lead.id}`)
              }}>
                <button type="submit" className="btn btn-primary w-100" style={{ width: '100%' }}>
                  Mark as Sent
                </button>
              </form>

              <form action={async () => {
                'use server'
                const supabase = await createClient()
                await supabase.rpc('record_outreach', { p_lead_id: lead.id, p_action: 'replied' })
                redirect(`/leads/${lead.id}`)
              }}>
                <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>Mark as Replied</button>
              </form>
              
              <form action={async () => {
                'use server'
                const supabase = await createClient()
                await supabase.rpc('record_outreach', { p_lead_id: lead.id, p_action: 'won' })
                redirect(`/leads/${lead.id}`)
              }}>
                <button type="submit" className="btn btn-secondary text-success" style={{ width: '100%' }}>Mark as Won</button>
              </form>
              
              <form action={async () => {
                'use server'
                const supabase = await createClient()
                await supabase.rpc('record_outreach', { p_lead_id: lead.id, p_action: 'lost' })
                redirect(`/leads/${lead.id}`)
              }}>
                <button type="submit" className="btn btn-secondary text-danger" style={{ width: '100%' }}>Mark as Lost</button>
              </form>
            </div>
          </div>
        </div>

        {/* Right column: Activity Log */}
        <div style={{ gridColumn: 'span 2' }}>
          <div className="card h-100" style={{ minHeight: '100%' }}>
            <h2 className="mb-4">Activity Log</h2>
            {!activities || activities.length === 0 ? (
              <p className="text-muted">No activity recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {activities.map((activity: any) => (
                  <div key={activity.id} className="flex gap-4 p-4 rounded" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                    <div className="text-muted" style={{ minWidth: '120px', fontSize: '0.875rem' }}>
                      {new Date(activity.created_at).toLocaleString()}
                    </div>
                    <div>
                      <div className="font-semibold capitalize mb-1">{activity.action_type}</div>
                      <div className="text-muted" style={{ fontSize: '0.875rem' }}>{activity.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
