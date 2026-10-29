import type { Metadata } from 'next'
import { ServerErrorView } from '@/components/errors/ServerErrorView'

export const metadata: Metadata = {
  title: '500 - Server Error | Selfera Sales Pipeline',
  description: 'An unexpected server issue occurred.',
}

export default function Page500() {
  return <ServerErrorView />
}
