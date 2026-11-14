'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, ChevronDown, LogOut, Menu, HelpCircle, Compass, MousePointer } from 'lucide-react'
import { useBreadcrumbs } from '@/components/BreadcrumbContext'
import { NotificationBell } from '@/components/NotificationBell'
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal'
import { usePresence } from '@/components/usePresence'
import { useSkeletonShowing } from '@/components/NavigationProgress'
import { useTour } from '@/components/tour/TourContext'

export function Topbar({ userProfile, email }: { userProfile: { id: string; full_name: string; role: string; display_role?: string }; email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { breadcrumbs } = useBreadcrumbs()
  // While the next page's skeleton shows, its breadcrumb isn't known yet; don't show the old page's
  const loadingPage = useSkeletonShowing()
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDivElement>(null)
  const menu = usePresence(open, 120)
  const helpMenu = usePresence(helpOpen, 120)
  const { currentModuleTour, startTour, openBrowseModal } = useTour()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false)
    }
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
          <button onClick={() => router.back()} className="btn btn-secondary btn-sm hidden min-[901px]:inline-flex" aria-label="Back">
            <ArrowLeft size={15} /> Back
          </button>
        )}

        {/* Brand Logo and Name in Responsive Mode */}
        <Link href="/dashboard" className="flex items-center gap-2 min-[901px]:hidden">
          <div className="h-7 w-7 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Selfera" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold leading-tight tracking-tight text-slate-900">
              Selfera<span className="text-primary">.</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-500 -mt-0.5">Sales Pipeline</span>
          </div>
        </Link>

        {/* Location path / Breadcrumbs in Desktop Mode */}
        <nav className="hidden min-[901px]:flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar text-sm" aria-label="Breadcrumb">
          {loadingPage ? (
            <span aria-hidden="true" className="skeleton h-7 w-40" />
          ) : (breadcrumbs.length ? breadcrumbs : [{ label: 'Dashboard' }]).map((c, i, arr) => (
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

        {/* Application Guide & Tour Button */}
        <div ref={helpRef} className="relative">
          <button
            type="button"
            onClick={() => setHelpOpen(o => !o)}
            aria-expanded={helpOpen}
            className="btn btn-ghost btn-sm relative !p-2 transition-transform active:scale-95"
            title="Application Guide & Tour"
            aria-label="Application Guide & Tour"
          >
            <HelpCircle size={19} className="text-slate-600" />
          </button>
          {helpMenu.mounted && (
            <div
              className={`absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ${
                helpMenu.closing ? 'motion-dropdown-out' : 'motion-dropdown-in'
              }`}
            >
              <div className="px-2.5 py-1.5 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-900">Module Tour</div>
                <div className="text-[11px] text-slate-500">Interactive walkthrough</div>
              </div>
              <div className="mt-1 space-y-0.5">
                {currentModuleTour && (
                  <button
                    type="button"
                    onClick={() => {
                      setHelpOpen(false)
                      startTour()
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <MousePointer size={14} className="text-primary shrink-0" />
                    <span className="truncate">Tour: {currentModuleTour.title}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen(false)
                    openBrowseModal()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Compass size={14} className="text-slate-400 shrink-0" />
                  <span>All Module Tours</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div ref={ref} className="relative">
          <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-50 active:scale-[0.98]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-white">
              {userProfile.full_name.charAt(0)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-bold">{userProfile.full_name}</span>
              <span className="block text-xs font-medium text-slate-500">{userProfile.display_role || userProfile.role}</span>
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
          {menu.mounted && (
            <div className={`absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ${menu.closing ? 'motion-dropdown-out' : 'motion-dropdown-in'}`}>
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
