'use client'

import { useTransition } from 'react'
import { LogOut, X } from 'lucide-react'
import { signOut } from '@/app/dashboard/actions'
import { Preloader } from '@/components/Preloader'

export function LogoutConfirmModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const handleConfirmLogout = () => {
    startTransition(async () => {
      await signOut()
    })
  }

  if (!open) return null

  if (isPending) {
    return <Preloader fullScreen />
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs transition-opacity animate-fadeIn"
      onMouseDown={onClose}
    >

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
            <LogOut size={24} />
          </div>

          <h3 className="text-base font-bold text-slate-900">
            Sign out?
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Are you sure you want to sign out?
          </p>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmLogout}
              disabled={isPending}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <LogOut size={16} className="shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
