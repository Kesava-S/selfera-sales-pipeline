'use client'

import { useEffect } from 'react'
import { ServerErrorView } from '@/components/errors/ServerErrorView'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  retry?: () => void
}) {
  useEffect(() => {
    console.error('Unhandled global root layout error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-white m-0 p-0 antialiased font-sans">
        <ServerErrorView />
      </body>
    </html>
  )
}

