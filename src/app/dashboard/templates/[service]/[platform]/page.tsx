import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplateSlots } from '@/components/v2/TemplatesView'
import { SERVICES, PLATFORMS, platformLabel, type TemplateRow } from '@/lib/templates'
import { ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function TemplateSlotsPage({ params }: { params: Promise<{ service: string; platform: string }> }) {
  const p = await params
  const service = decodeURIComponent(p.service)
  const platform = decodeURIComponent(p.platform)
  if (!SERVICES.includes(service) || !PLATFORMS.includes(platform)) notFound()

  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  // All templates, so the page can show which one is used when a slot is empty
  const { data, error } = await supabase.from('templates').select('id, name, platform, step, services, subject, body, is_active')

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates', href: '/dashboard/templates' },
          { label: service, href: `/dashboard/templates?service=${encodeURIComponent(service)}` },
          { label: platformLabel(platform) },
        ]}
      />
      {error
        ? <ErrorNote error={error.message} />
        : <TemplateSlots templates={(data as TemplateRow[]) || []} service={service} platform={platform} isAdmin={profile.role === 'admin'} />}
    </>
  )
}
