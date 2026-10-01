'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, FileText, Sliders, BarChart2 } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/leads', label: 'Lead Management', icon: Users },
  { href: '/dashboard/insights', label: 'Insights', icon: BarChart2 },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', icon: Sliders },
]

const SECTION_PREFIXES = ['/dashboard/leads', '/dashboard/insights', '/dashboard/templates', '/dashboard/settings']

export function Sidebar({ userProfile, reviewCount }: { userProfile: { full_name: string; role: string }; reviewCount: number }) {
  const pathname = usePathname()
  const close = () => document.querySelector('.sidebar')?.classList.remove('open')

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="sidebar-logo" onClick={close}>
        <div className="sidebar-logo-icon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-extrabold leading-tight tracking-tight text-slate-900">
            Selfera<span className="text-primary">.</span>
          </span>
          <span className="text-xs font-semibold text-slate-500">Sales Pipeline</span>
        </div>
      </Link>

      <nav className="sidebar-nav">
        {NAV.map(item => {
          const active =
            item.href === '/dashboard'
              ? pathname.startsWith('/dashboard') && !SECTION_PREFIXES.some(p => pathname.startsWith(p))
              : pathname.startsWith(item.href)
          const Icon = item.icon
          const badge = item.href === '/dashboard/leads' && reviewCount > 0 ? reviewCount : null
          return (
            <Link key={item.href} href={item.href} onClick={close} className={`nav-item ${active ? 'active' : ''}`}>
              <Icon size={18} />
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              {badge !== null && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800" title="Leads waiting for review">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-white">
            {userProfile.full_name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{userProfile.full_name}</div>
            <div className="text-xs capitalize text-slate-500">{userProfile.role}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
