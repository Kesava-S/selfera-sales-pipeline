import type { Metadata } from 'next'
import { OfflineView } from '@/components/errors/OfflineView'

export const metadata: Metadata = {
  title: 'Connection Lost | Selfera Marketing',
  description: 'Your device appears to be offline.',
}

export default function OfflinePage() {
  return <OfflineView />
}

