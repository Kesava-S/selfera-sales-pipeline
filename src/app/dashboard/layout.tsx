import type { Metadata } from 'next'

import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { AddLeadModalProvider } from '@/components/AddLeadModalProvider'
import { BreadcrumbProvider } from '@/components/BreadcrumbContext'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountNotSetup } from '@/components/v2/AccountNotSetup'

export const metadata: Metadata = {
  title: 'Selfera. | Sales Pipeline',
  description: 'AI Automation for UK small businesses - bookings, follow ups, operations and sales cadence workflows.',
  icons: {
    icon: '/logo.png',
  },
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let userEmail = 'test@example.com'

  if (user) {
    userEmail = user.email || 'test@example.com'
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    profile = data
  }

  if (!profile) {
    return <AccountNotSetup />
  }

  return (
    <BreadcrumbProvider>
      <AddLeadModalProvider>
        <div className="app-layout">
          <Sidebar userProfile={profile} />
          <div className="main-wrapper">
            <Topbar userProfile={profile} email={userEmail} />
            <main className="main-content">{children}</main>
          </div>
        </div>
      </AddLeadModalProvider>
    </BreadcrumbProvider>
  )
}
