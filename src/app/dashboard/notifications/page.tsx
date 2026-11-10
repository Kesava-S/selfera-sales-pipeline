import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { NotificationsView } from '@/components/notifications/NotificationsView'
import { Note } from '@/components/NotificationBell'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const { supabase, profile, user } = await requireProfile()
  if (!profile || !user) return null

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, message, link, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Notifications' },
        ]}
      />
      <NotificationsView
        initialNotifications={(notifications || []) as Note[]}
        userId={user.id}
      />
    </>
  )
}

