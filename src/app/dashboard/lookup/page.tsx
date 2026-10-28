import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { LeadLookupView, type LookupLead } from '@/components/v2/LeadLookupView'
import { lookupConfig } from '@/lib/enrich'

export const dynamic = 'force-dynamic'

// Google Places + Companies House lookups, to fill in a lead's missing details
export default async function LeadLookupPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return null

  const { data: leads } = await supabase
    .from('businesses')
    .select('id, business_name, business_type, area, address, postcode, phone, existing_website, maps_link, google_rating, google_reviews_count, company_type, contact_name')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <>
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Lead Lookup' }]} />
      <LeadLookupView leads={(leads || []) as LookupLead[]} config={lookupConfig()} />
    </>
  )
}
