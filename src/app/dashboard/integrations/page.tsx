import { requireProfile } from '@/lib/auth'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { IntegrationsView } from '@/components/integrations/IntegrationsView'
import { getDynamicChannels } from '@/lib/integrations'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Integrations | Selfera Sales Pipeline',
  description: 'Manage real-time communication channels and API integrations.',
}

export default async function IntegrationsPage() {
  const { profile } = await requireProfile()
  if (!profile) return null

  const channels = await getDynamicChannels()

  return (
    <>
      <BreadcrumbSetter
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Integrations' },
        ]}
      />
      <IntegrationsView initialChannels={channels} isAdmin={profile.role === 'admin'} />
    </>
  )
}

