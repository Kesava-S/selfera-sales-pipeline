import { createClient } from '@/lib/supabase/server'
import { CheckCircle, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TodayTasks() {
  const supabase = await createClient()

  // Get current user (if logged in, but let's assume we fetch all tasks due today for now
  // or handle auth if properly set up. For this MVP, we fetch tasks due today that are open)
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      *,
      leads (
        business_name,
        channel
      )
    `)
    .eq('status', 'open')
    // In a real app we'd filter by due_date <= today, but let's just get open tasks for the demo
    .order('due_date', { ascending: true })

  if (error) {
    console.error(error)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>Today's Tasks</h1>
        <div className="badge badge-primary" style={{ backgroundColor: 'rgba(92, 111, 255, 0.15)', color: 'var(--primary)' }}>
          {tasks?.length || 0} Open Tasks
        </div>
      </div>

      <div className="grid">
        {!tasks || tasks.length === 0 ? (
          <div className="card text-center" style={{ padding: '3rem' }}>
            <CheckCircle size={48} className="text-muted" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h2>You're all caught up!</h2>
            <p className="text-muted mb-0">No tasks due today. Great job.</p>
          </div>
        ) : (
          tasks.map((task: any) => (
            <div key={task.id} className="card card-hover flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold" style={{ fontSize: '1.125rem' }}>{task.title}</h3>
                  {task.task_type === 'sales_followup' && (
                    <span className="badge badge-warning">Follow up</span>
                  )}
                  {task.leads?.channel === 'WhatsApp' && (
                    <span className="badge badge-success">WhatsApp</span>
                  )}
                </div>
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                  {task.description || 'No description provided.'}
                </p>
                {task.leads && (
                  <div className="mt-2 text-muted" style={{ fontSize: '0.75rem' }}>
                    Lead: <span className="font-semibold text-foreground">{task.leads.business_name}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-4 items-center">
                <div className="text-muted flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
                  <Clock size={16} />
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                </div>
                {task.task_type === 'sales_followup' && task.leads?.channel !== 'Email' && (
                  <form action={async () => {
                    'use server'
                    const supabase = await createClient()
                    // Record outreach and complete task
                    await supabase.rpc('record_outreach', {
                      p_lead_id: task.lead_id,
                      p_action: 'sent',
                      p_task_id: task.id,
                      p_details: 'Manual outreach recorded'
                    })
                  }}>
                    <button type="submit" className="btn btn-primary">
                      Mark as sent
                    </button>
                  </form>
                )}
                {task.task_type !== 'sales_followup' && (
                  <form action={async () => {
                    'use server'
                    const supabase = await createClient()
                    await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
                  }}>
                    <button type="submit" className="btn btn-secondary">
                      <CheckCircle size={18} />
                      Complete
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
