import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplatesManager } from '@/components/v2/TemplatesManager'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .order('name')

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Templates' }]} />
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <TemplatesManager initialTemplates={templates || []} />
      </div>
    </>
  )
}
