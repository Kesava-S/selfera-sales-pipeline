import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { TemplatesHome } from '@/components/v2/TemplatesView'
import { type TemplateRow, type TemplateCategory } from '@/lib/templates'
import { getDynamicApiPlatforms } from '@/lib/integrations'
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

  // Fetch templates, business_categories, distinct lead business types, and connected platforms in parallel
  const [templatesRes, categoriesRes, businessesRes, connectedPlatforms] = await Promise.all([
    supabase
      .from('templates')
      .select('id, name, platform, step, services, business_types, subject, body, whatsapp_template_name, is_active'),
    supabase
      .from('business_categories')
      .select('id, name, slug, icon_name, description, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('businesses')
      .select('business_type')
      .not('business_type', 'is', null),
    getDynamicApiPlatforms().catch(() => []),
  ])

  // Baseline category 'General' is always first
  const categories: TemplateCategory[] = [
    {
      key: 'General',
      label: 'General (all business types)',
      desc: 'Default baseline for all business types',
      iconName: 'Globe',
    },
  ]

  const seenKeys = new Set(['General'])

  // Add DB business categories
  for (const c of categoriesRes.data || []) {
    if (!seenKeys.has(c.name)) {
      seenKeys.add(c.name)
      categories.push({
        id: c.id,
        key: c.name,
        label: c.name,
        desc: c.description || `${c.name} specific outreach templates`,
        iconName: c.icon_name || 'Building2',
      })
    }
  }

  // Add any business type found in businesses table that isn't yet listed
  for (const b of businessesRes.data || []) {
    const bt = b.business_type?.trim()
    if (bt && !seenKeys.has(bt)) {
      seenKeys.add(bt)
      categories.push({
        key: bt,
        label: bt,
        desc: `${bt} outreach templates`,
        iconName: 'Building2',
      })
    }
  }

  // Add any business type tagged on existing templates
  for (const t of (templatesRes.data as TemplateRow[]) || []) {
    const bt = t.business_types?.[0]?.trim()
    if (bt && !seenKeys.has(bt)) {
      seenKeys.add(bt)
      categories.push({
        key: bt,
        label: bt,
        desc: `${bt} outreach templates`,
        iconName: 'Building2',
      })
    }
  }

  const selected = type && (seenKeys.has(type) || type.trim().length > 0) ? type : null

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates' },
          ...(selected ? [{ label: selected }] : []),
        ]}
      />
      {templatesRes.error ? (
        <ErrorNote error={templatesRes.error.message} />
      ) : (
        <TemplatesHome
          templates={(templatesRes.data as TemplateRow[]) || []}
          selected={selected}
          categories={categories}
          connectedPlatforms={connectedPlatforms}
          isAdmin={profile.role === 'admin'}
        />
      )}
    </>
  )
}
