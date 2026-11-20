import { requireProfile } from '@/lib/auth'
import { actsAsSales } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { LeadDiscoveryView } from '@/components/v2/LeadDiscoveryView'
import { getSalesLists } from '@/lib/dynamicData'
import { AccountNotSetup } from '@/components/v2/AccountNotSetup'
import { EmptyState } from '@/components/ui'
import { getSerpApiBalance } from './actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Lead Discovery | Selfera Marketing',
  description: 'Top-of-funnel market discovery and automated prospect sourcing engine.',
}

export default async function LeadDiscoveryPage() {
  const { supabase, profile } = await requireProfile()
  if (!profile) return <AccountNotSetup />
  if (profile.role !== 'admin' && !actsAsSales(profile.role)) {
    return <EmptyState title="Lead Discovery is for the admin and sales team" />
  }

  const lists = await getSalesLists()

  let businessCount = 0
  try {
    const { count } = await supabase
      .from('businesses')
      .select('id', { count: 'exact', head: true })
      .eq('archived', false)
    businessCount = count ?? 0
  } catch {
    businessCount = 0
  }

  const serpApiBalance = await getSerpApiBalance()

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Lead Discovery' },
        ]}
      />
      <LeadDiscoveryView
        categories={lists.categories || []}
        services={lists.services || []}
        existingBusinessCount={businessCount}
        initialSerpApiBalance={serpApiBalance}
      />
    </>
  )
}
