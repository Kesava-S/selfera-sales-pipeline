import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

export const dynamic = 'force-dynamic'

export default async function InsightsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Insights' }]} />
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="font-semibold text-2xl mb-6">Insights</h1>
        <div className="card text-center py-12 text-muted">
          <p className="text-lg font-medium text-slate-800">Coming Soon</p>
          <p className="mt-2 text-sm">Advanced reporting and analytics are currently in development.</p>
        </div>
      </div>
    </>
  )
}
