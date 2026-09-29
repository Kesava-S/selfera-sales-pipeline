import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { AddLeadModalProvider } from '@/components/AddLeadModalProvider'

export const metadata: Metadata = {
  title: 'Selfera. | Sales Pipeline',
  description: 'AI Automation for UK small businesses - bookings, follow ups, operations and sales cadence workflows.',
  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AddLeadModalProvider>
          <div className="app-layout">
            <Sidebar />
            <div className="main-wrapper">
              <Topbar />
              <main className="main-content">{children}</main>
            </div>
          </div>
        </AddLeadModalProvider>
      </body>
    </html>
  )
}
