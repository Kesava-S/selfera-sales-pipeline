import { Metadata } from 'next'
import { LoginView } from '@/components/LoginView'

export const metadata: Metadata = {
  title: 'Sign In | Selfera Sales Pipeline',
  description: 'Sign in to your Selfera workspace to manage sales pipelines, outreach cadences, and lead conversions.',
}

export default function LoginPage() {
  return <LoginView />
}
