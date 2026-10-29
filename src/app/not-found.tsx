import type { Metadata } from 'next'
import { NotFoundView } from '@/components/errors/NotFoundView'

export const metadata: Metadata = {
  title: '404 - Page Not Found | Selfera Sales Pipeline',
  description: 'The requested page could not be found.',
}

export default function NotFound() {
  return <NotFoundView />
}

