import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplateSlots } from '@/components/v2/TemplatesView'
import type { MetaTemplateRow } from '@/components/whatsapp/MetaTemplateSection'
import { PLATFORMS, platformLabel, type TemplateRow } from '@/lib/templates'
import { getDynamicApiPlatforms } from '@/lib/integrations'
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

  if (!type || !type.trim() || !PLATFORMS.includes(platform as any)) {
    notFound()
  }

  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  // Fetch all templates, connected platforms, and this product's Meta templates (for WhatsApp) in parallel
  const isWhatsApp = platform === 'WhatsApp'
  // Meta approves templates on its side: re-check any that are in review or out of date first
  if (isWhatsApp) await import('@/lib/metaTemplates').then(m => m.refreshMetaTemplateStatuses()).catch(() => {})
  const [{ data, error }, connectedPlatforms, metaTemplatesRes] = await Promise.all([
    supabase
      .from('templates')
      .select('id, name, platform, step, services, business_types, subject, body, whatsapp_template_name, is_active'),
    getDynamicApiPlatforms().catch(() => []),
    isWhatsApp
      ? supabase
          .from('meta_templates')
          .select('id, meta_id, name, language, category, status, components, rejected_reason, quality_score, variable_map, last_synced_at')
          .eq('managed', true)
          .order('name')
      : Promise.resolve({ data: [] }),
  ])

  let metaTemplates = metaTemplatesRes.data || []
  if (isWhatsApp && metaTemplates.some(m => m.status === 'PENDING')) {
    try {
      const { syncMetaTemplates } = await import('@/app/dashboard/templates/metaActions')
      await syncMetaTemplates()
      const { data: refreshed } = await supabase
        .from('meta_templates')
        .select('id, meta_id, name, language, category, status, components, rejected_reason, quality_score, variable_map, last_synced_at')
        .eq('managed', true)
        .order('name')
      if (refreshed) metaTemplates = refreshed
    } catch {
      // Fallback
    }
  }

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
          connectedPlatforms={connectedPlatforms}
          metaTemplates={(metaTemplates || []) as MetaTemplateRow[]}
        />
      )}
    </>
  )
}
