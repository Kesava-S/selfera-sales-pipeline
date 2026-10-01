import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplatesHome } from '@/components/v2/TemplatesView'
import { SERVICES, type TemplateRow } from '@/lib/templates'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const { data, error } = await supabase.from('templates').select('id, name, platform, step, services, subject, body, is_active')
  const selected = service && SERVICES.includes(service) ? service : null

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Templates' }]} />
      {error ? <ErrorNote error={error.message} /> : <TemplatesHome templates={(data as TemplateRow[]) || []} selected={selected} />}
    </>
  )
}
