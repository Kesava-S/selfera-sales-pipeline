import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplatesHome } from '@/components/v2/TemplatesView'
import { TEMPLATE_BUSINESS_TYPES, type TemplateRow } from '@/lib/templates'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const { data, error } = await supabase
    .from('templates')
    .select('id, name, platform, step, services, business_types, subject, body, is_active')
  const selected = type && TEMPLATE_BUSINESS_TYPES.includes(type as any) ? type : null

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates' },
          ...(selected ? [{ label: selected }] : []),
        ]}
      />
      {error ? (
        <ErrorNote error={error.message} />
      ) : (
        <TemplatesHome templates={(data as TemplateRow[]) || []} selected={selected} />
      )}
    </>
  )
}
