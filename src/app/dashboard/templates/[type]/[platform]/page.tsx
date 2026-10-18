import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplateSlots } from '@/components/v2/TemplatesView'
import { TEMPLATE_BUSINESS_TYPES, PLATFORMS, platformLabel, type TemplateRow } from '@/lib/templates'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function TemplateSlotsPage({
  params,
}: {
  params: Promise<{ type: string; platform: string }>
}) {
  const p = await params
  const type = decodeURIComponent(p.type)
  const platform = decodeURIComponent(p.platform)
  if (!TEMPLATE_BUSINESS_TYPES.includes(type as any) || !PLATFORMS.includes(platform as any)) notFound()

  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  // All templates, so the page can show which one is used when a slot is empty
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, platform, step, services, business_types, subject, body, is_active')

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates', href: '/dashboard/templates' },
          { label: type, href: `/dashboard/templates?type=${encodeURIComponent(type)}` },
          { label: platformLabel(platform) },
        ]}
      />
      {error ? (
        <ErrorNote error={error.message} />
      ) : (
        <TemplateSlots
          templates={(data as TemplateRow[]) || []}
          businessType={type}
          platform={platform}
          isAdmin={profile.role === 'admin'}
        />
      )}
    </>
  )
}
