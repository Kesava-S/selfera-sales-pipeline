import type { Metadata } from 'next'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { NavigationProgress } from '@/components/NavigationProgress'
import { BreadcrumbProvider } from '@/components/BreadcrumbContext'
import { AccountNotSetup } from '@/components/v2/AccountNotSetup'
import { requireProfile, getDashboardStatusCounts } from '@/lib/auth'
import { getSalesLists } from '@/lib/dynamicData'
import { ListsProvider } from '@/components/ListsContext'

export const metadata: Metadata = {
  title: 'Selfera. | Sales Pipeline',
  description: 'Selfera sales pipeline',
  icons: { icon: '/logo.png' },
}

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { supabase, user, profile } = await requireProfile()
  if (!profile) return <AccountNotSetup />

  const [{ data: counts }, lists] = await Promise.all([
    getDashboardStatusCounts(supabase, user.id),
    getSalesLists(),
  ])
  const reviewCount = Number(counts?.[0]?.needs_review ?? 0)

  return (
    <BreadcrumbProvider>
      <NavigationProgress />
      <div className="app-layout">
        <Sidebar userProfile={profile} reviewCount={profile.role === 'consultant' ? 0 : reviewCount} />
        <div className="main-wrapper">
          <Topbar userProfile={profile} email={user.email ?? ''} />
          <main className="main-content"><ListsProvider lists={lists}>{children}</ListsProvider></main>
        </div>
      </div>
    </BreadcrumbProvider>
  )
}
