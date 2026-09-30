import type { Metadata } from 'next'
import './globals.css'

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
        {children}
      </body>
    </html>
  )
}
