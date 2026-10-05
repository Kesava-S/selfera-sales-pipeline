'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, ChevronDown, LogOut, Menu } from 'lucide-react'
import { useBreadcrumbs } from '@/components/BreadcrumbContext'
import { NotificationBell } from '@/components/NotificationBell'
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal'

export function Topbar({ userProfile, email }: { userProfile: { id: string; full_name: string; role: string; display_role?: string }; email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { breadcrumbs } = useBreadcrumbs()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <>
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
              <span className="block text-xs font-medium text-slate-500">{userProfile.display_role || userProfile.role}</span>
            </span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {open && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="px-1 pb-2.5">
                <div className="text-sm font-bold text-slate-900">{userProfile.full_name}</div>
                <div className="truncate text-xs text-slate-500">{email}</div>
                <div className="mt-1 text-xs font-semibold text-primary">{userProfile.display_role || userProfile.role}</div>
              </div>

              <div className="border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setConfirmLogout(true)
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-700 active:scale-[0.98]"
                >
                  <LogOut size={15} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    <LogoutConfirmModal open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </>
  )
}
