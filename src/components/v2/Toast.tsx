'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

type ToastListener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let listeners: ToastListener[] = []

function notify() {
  listeners.forEach(fn => fn([...toasts]))
}

export const toast = {
  show(message: string, options?: { type?: ToastType; title?: string; duration?: number }) {
    const id = Math.random().toString(36).substring(2, 9)
    const item: ToastItem = {
      id,
      type: options?.type || 'info',
      title: options?.title,
      message,
      duration: options?.duration ?? 5000,
    }
    toasts = [...toasts, item]
    notify()
    return id
  },
  success(message: string, options?: { title?: string; duration?: number }) {
    return this.show(message, { ...options, type: 'success' })
  },
  error(message: string, options?: { title?: string; duration?: number }) {
    return this.show(message, { ...options, type: 'error' })
  },
  warning(message: string, options?: { title?: string; duration?: number }) {
    return this.show(message, { ...options, type: 'warning' })
  },
  info(message: string, options?: { title?: string; duration?: number }) {
    return this.show(message, { ...options, type: 'info' })
  },
  dismiss(id: string) {
    toasts = toasts.filter(t => t.id !== id)
    notify()
  },
  clear() {
    toasts = []
    notify()
  },
}

const PROGRESS_COLOR: Record<ToastType, string> = {
  success: 'bg-emerald-500/70',
  error: 'bg-red-500/70',
  warning: 'bg-amber-500/70',
  info: 'bg-sky-500/70',
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  // Slide out first, then collapse the slot so the toasts below move up smoothly
  const [leaving, setLeaving] = useState(false)
  const leave = () => setLeaving(true)

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => onDismiss(item.id), 220)
    return () => clearTimeout(t)
  }, [leaving, item.id, onDismiss])

  // Outlined icons only
  const icons = {
    success: <CheckCircle2 size={18} strokeWidth={2} className="text-emerald-600 shrink-0 motion-check-pop" />,
    error: <AlertCircle size={18} strokeWidth={2} className="text-red-600 shrink-0" />,
    warning: <AlertTriangle size={18} strokeWidth={2} className="text-amber-600 shrink-0" />,
    info: <Info size={18} strokeWidth={2} className="text-sky-600 shrink-0" />,
  }

  const defaultTitles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Notice',
  }

  const timed = Boolean(item.duration && item.duration > 0)

  return (
    <div className={`toast-slot ${leaving ? 'leaving' : ''}`}>
      <div>
        <div
          role="alert"
          className={`toast-card pointer-events-auto relative w-[360px] sm:w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10 flex items-start gap-3 ${leaving ? 'toast-out' : 'toast-in'}`}
        >
          <div className="mt-0.5 shrink-0">
            {icons[item.type]}
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-semibold text-slate-900 tracking-tight">
                {item.title || defaultTitles[item.type]}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed break-words whitespace-pre-wrap">
              {item.message}
            </p>
          </div>
          <button
            type="button"
            onClick={leave}
            className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer shrink-0"
            aria-label="Dismiss alert"
          >
            <X size={15} strokeWidth={2} />
          </button>
          {/* Time left; pauses on hover (CSS) and dismisses the toast when it runs out */}
          {timed && !leaving && (
            <span
              aria-hidden="true"
              className={`toast-progress absolute bottom-0 left-0 h-[3px] w-full ${PROGRESS_COLOR[item.type]}`}
              style={{ '--toast-duration': `${item.duration}ms` } as React.CSSProperties}
              onAnimationEnd={leave}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler: ToastListener = next => setCurrentToasts(next)
    listeners.push(handler)
    setCurrentToasts([...toasts])
    return () => {
      listeners = listeners.filter(fn => fn !== handler)
    }
  }, [])

  if (currentToasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[9999] flex flex-col pointer-events-none max-w-full"
    >
      {currentToasts.map(t => (
        <ToastCard key={t.id} item={t} onDismiss={toast.dismiss} />
      ))}
    </div>
  )
}
