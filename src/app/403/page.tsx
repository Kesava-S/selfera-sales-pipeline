import type { Metadata } from 'next'
import { ForbiddenView } from '@/components/errors/ForbiddenView'

export const metadata: Metadata = {
  title: '403 - Access Denied | Selfera Sales Pipeline',
  description: 'You do not have permission to access this resource.',
}

export default function Page403() {
  return <ForbiddenView />
}
