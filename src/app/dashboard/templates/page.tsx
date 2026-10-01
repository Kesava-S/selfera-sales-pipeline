import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplatesView, type TemplateRow } from '@/components/v2/TemplatesView'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const { data, error } = await supabase
    .from('templates')
    .select('id, name, platform, step, services, subject, body, is_active')
    .order('name')

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Templates' }]} />
      <TemplatesView templates={(data as TemplateRow[]) || []} loadError={error?.message ?? null} isAdmin={profile.role === 'admin'} />
    </>
  )
}
