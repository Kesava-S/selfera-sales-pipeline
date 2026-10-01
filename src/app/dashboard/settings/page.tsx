import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { SettingsManager } from '@/components/v2/SettingsManager'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // We try to fetch from cadence_rules. If the table doesn't exist yet, this will gracefully return an error 
  // and we'll pass an empty array, prompting the user to run the migration.
  const { data: cadenceRules, error } = await supabase
    .from('cadence_rules')
    .select('*')
    .order('step_name')

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <SettingsManager cadenceRules={error ? [] : (cadenceRules || [])} />
      </div>
    </>
  )
}
