import type { Metadata, Viewport } from 'next'
import './globals.css'
import PresenceHeartbeat from '@/components/PresenceHeartbeat'
import { ToastContainer } from '@/components/v2/Toast'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Selfera. | Sales Pipeline',
  description: 'Automation for UK small businesses - bookings, follow ups, operations and sales cadence workflows.',
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
        <ToastContainer />
        {children}
      </body>
    </html>
  )
}
