import type { Metadata } from 'next'
import './globals.css'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'

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
        <PresenceHeartbeat />
        {children}
      </body>
    </html>
  )
}
