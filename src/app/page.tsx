import { createClient } from '@/lib/supabase/server'
import type { Task, ExtendedLead } from '@/types/database'
import { TodayTasksView } from '@/components/TodayTasksView'

export const dynamic = 'force-dynamic'

export default async function TodayTasks() {
  let liveTasks: Task[] = []
  let allLeads: ExtendedLead[] = []

  try {
    const supabase = await createClient()
    const [tasksRes, leadsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(`
          *,
          leads (
            id,
            lead_code,
            business_name,
            channel,
            phone,
            email,
            instagram_handle,
            stage,
            follow_up_count,
            next_follow_up
          )
        `)
        .eq('status', 'open')
        .order('due_date', { ascending: true }),
      supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    if (!tasksRes.error && tasksRes.data) {
      liveTasks = tasksRes.data as Task[]
    }
    if (!leadsRes.error && leadsRes.data) {
      allLeads = leadsRes.data as ExtendedLead[]
    }
  } catch (err) {
    console.error('Failed to load tasks from database:', err)
  }

  return <TodayTasksView initialTasks={liveTasks} initialLeads={allLeads} />
}
