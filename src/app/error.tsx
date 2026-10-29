'use client'

import { useEffect } from 'react'
import { ServerErrorView } from '@/components/errors/ServerErrorView'

export default function ErrorBoundary({
  error,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  retry?: () => void
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error)
  }, [error])

  return <ServerErrorView />
}

