import type { Metadata } from 'next'
import './globals.css'
import { AddLeadModalProvider } from '@/components/AddLeadModalProvider'
import { AppShell } from '@/components/AppShell'

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
          <AppShell>{children}</AppShell>
        </AddLeadModalProvider>
      </body>
    </html>
  )
}
