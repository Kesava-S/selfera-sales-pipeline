import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="font-semibold text-2xl mb-6">Settings & Cadence Rules (V2)</h1>
      <div className="card text-center py-12 text-muted">
        <p>This page is currently being rebuilt for the new V2 architecture.</p>
        <p className="mt-2 text-sm">Cadence logic is now enforced via PostgreSQL RPC functions (see config.ts and daily_update()).</p>
      </div>
    </div>
  )
}
