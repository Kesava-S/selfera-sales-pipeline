'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, ChevronDown, LogOut, Menu } from 'lucide-react'
import { useBreadcrumbs } from '@/components/BreadcrumbContext'
import { NotificationBell } from '@/components/NotificationBell'
import { signOut } from '@/app/dashboard/actions'

export function Topbar({ userProfile, email }: { userProfile: { id: string; full_name: string; role: string }; email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { breadcrumbs } = useBreadcrumbs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="topbar">
      <div className="flex min-w-0 items-center gap-2">
        <button
          className="btn btn-ghost btn-sm !p-1.5 min-[901px]:hidden"
          aria-label="Menu"
          onClick={() => document.querySelector('.sidebar')?.classList.toggle('open')}
        >
          <Menu size={20} />
        </button>
        {pathname !== '/dashboard' && (
          <button onClick={() => router.back()} className="btn btn-secondary btn-sm hidden sm:inline-flex" aria-label="Back">
            <ArrowLeft size={15} /> Back
          </button>
        )}
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm" aria-label="Breadcrumb">
          {(breadcrumbs.length ? breadcrumbs : [{ label: 'Dashboard' }]).map((c, i, arr) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
              {c.href && i < arr.length - 1 ? (
                <Link href={c.href} className="shrink-0 rounded px-1 font-semibold text-slate-500 hover:text-slate-900">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-900">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell userId={userProfile.id} />
        <div ref={ref} className="relative">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 hover:bg-slate-50">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-white">
              {userProfile.full_name.charAt(0)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-bold">{userProfile.full_name}</span>
              <span className="block text-xs capitalize text-slate-500">{userProfile.role}</span>
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {open && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <div className="px-2 py-1.5">
                <div className="text-sm font-bold">{userProfile.full_name}</div>
                <div className="truncate text-xs text-slate-500">{email}</div>
                <div className="mt-1 text-xs font-semibold capitalize text-primary">{userProfile.role}</div>
              </div>
              <form action={signOut}>
                <button className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <LogOut size={16} /> Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
