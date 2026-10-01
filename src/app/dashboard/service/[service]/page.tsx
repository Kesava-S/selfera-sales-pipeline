import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Building2, ChevronRight } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { CONFIG } from '@/lib/config'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'
import { EmptyState, ErrorNote } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const service = decodeURIComponent((await params).service)
  if (!(CONFIG.SERVICES as readonly string[]).includes(service)) notFound()
  const { supabase, user, profile } = await requireProfile()
  if (!profile) return null

  const { data, error } = await supabase.rpc('v_business_type_counts', { p_service: service, p_user: user.id })
  const counts = (data || []) as { business_type: string; businesses_count: number; replies_count: number; due_today_count: number }[]

  return (
    <div className="space-y-5">
      <BreadcrumbSetter breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: service }]} />
      <h1>{service}</h1>
      <ErrorNote error={error?.message} />
      {counts.length === 0 ? (
        <EmptyState icon={<Building2 size={36} />} title={`No ${service} pitches yet`} text="Businesses appear here once a pitch for this service is approved or assigned to you." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map(c => (
            <Link key={c.business_type} href={`/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(c.business_type)}`} className="card card-link flex flex-col gap-4 !p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold"><Building2 size={18} className="text-primary" /> {c.business_type}</span>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Businesses', c.businesses_count, ''], ['Replies', c.replies_count, 'text-emerald-700'], ['Due today', c.due_today_count, 'text-amber-700']].map(([l, n, tone]) => (
                  <div key={l as string} className="rounded-lg bg-slate-50 py-2">
                    <div className={`text-lg font-bold ${tone}`}>{Number(n)}</div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{l}</div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
