import { requireProfile } from '@/lib/auth'
import { actsAsSales } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { DiscoveryHistoryView } from '@/components/v2/DiscoveryHistoryView'
import { AccountNotSetup } from '@/components/v2/AccountNotSetup'
import { EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Discovery History | Selfera Marketing',
  description: 'Review and manage past lead discovery searches and extracted prospects.',
}

export default async function DiscoveryHistoryPage() {
  const { profile } = await requireProfile()
  if (!profile) return <AccountNotSetup />
  if (profile.role !== 'admin' && !actsAsSales(profile.role)) {
    return <EmptyState title="Lead Discovery is for the admin and sales team" />
  }

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Lead Discovery', href: '/dashboard/discovery' },
          { label: 'Search History' },
        ]}
      />
      <DiscoveryHistoryView />
    </>
  )
}
