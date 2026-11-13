'use client'

// Small shared pieces used across the dashboard
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
export { Preloader, LogoPreloader, ButtonSpinner, CircleLoader } from '@/components/Preloader'
export { toast, ToastContainer } from '@/components/v2/Toast'
import { toast } from '@/components/v2/Toast'
import { MessageCircle, Camera, ThumbsUp, Mail, X, Loader2, ChevronLeft, ChevronRight, Layers, Check, AlertTriangle, Info } from 'lucide-react'
import { STAGE_STYLE, STATUS_STYLE } from '@/lib/config'
import type { ActionResult } from '@/app/dashboard/actions'
import { usePresence } from '@/components/usePresence'

function LinkedinIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

// ---------- Platform icon ----------
const PLATFORM_ICON: Record<string, { Icon: any; color: string }> = {
  WhatsApp: { Icon: MessageCircle, color: 'text-emerald-600' },
  Instagram: { Icon: Camera, color: 'text-pink-600' },
  Facebook: { Icon: ThumbsUp, color: 'text-blue-600' },
  Email: { Icon: Mail, color: 'text-sky-600' },
  LinkedIn: { Icon: LinkedinIcon, color: 'text-[#0a66c2]' },
  All: { Icon: Layers, color: 'text-indigo-600' },
}

export function PlatformIcon({ platform, size = 16, className = '' }: { platform: string; size?: number; className?: string }) {
  const p = PLATFORM_ICON[platform] ?? PLATFORM_ICON.Email
  return <p.Icon size={size} className={`${p.color} ${className}`} aria-label={platform} />
}

// Platform icon with a coloured status dot (used on cards and tables)
export function PlatformStatus({ platform, status, step }: { platform: string; status?: string; step?: number }) {
  const s = status ? STATUS_STYLE[status] : null
  return (
    <span
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white"
      title={`${platform}: ${status ?? 'not started'}${step ? ` (step ${step} of 4)` : ''}`}
    >
      <PlatformIcon platform={platform} size={15} className={status ? '' : 'opacity-30'} />
      {s && <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${s.dot}`} />}
    </span>
  )
}

// ---------- Badges ----------
export function StageBadge({ stage }: { stage: string }) {
  return <span className={`badge border ${STAGE_STYLE[stage] ?? ''}`}>{stage}</span>
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s?.text ?? 'text-slate-600'}`}>
      <span className={`h-2 w-2 rounded-full ${s?.dot ?? 'bg-slate-300'}`} />
      {status}
    </span>
  )
}

// ---------- Modal ----------
// `locked` keeps the modal open (Esc, backdrop and X give a small nudge instead) while a save is running.
// Opening scales the panel in; closing plays the reverse before it is removed.
const MODAL_EXIT_MS = 160

// Stops the page behind a dialog from scrolling. Counts open dialogs so a dialog
// opened on top of another (or closing one of two) doesn't unlock the page early.
let scrollLocks = 0
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const html = document.documentElement
    if (scrollLocks++ === 0) {
      // Keep the layout still where the scrollbar was
      const gap = window.innerWidth - html.clientWidth
      html.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      if (gap > 0) document.body.style.paddingRight = `${gap}px`
    }
    return () => {
      if (--scrollLocks === 0) {
        html.style.overflow = ''
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
      }
    }
  }, [active])
}

export function Modal({ title, open, onClose, children, wide, locked }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean | 'xl'; locked?: boolean }) {
  // Closing from inside (X, Esc, backdrop) animates out first, then tells the parent
  const [exiting, setExiting] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setExiting(false)
  }
  const { mounted, closing } = usePresence(open && !exiting, MODAL_EXIT_MS)
  const [nudging, setNudging] = useState(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  const requestClose = useCallback(() => {
    if (locked) return setNudging(true)
    setExiting(true)
  }, [locked])

  useEffect(() => {
    if (!exiting) return
    const t = setTimeout(() => onCloseRef.current(), MODAL_EXIT_MS)
    return () => clearTimeout(t)
  }, [exiting])

  useEffect(() => {
    if (!mounted || closing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted, closing, requestClose])

  useScrollLock(mounted)

  if (!mounted) return null
  const content = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs ${closing ? 'motion-backdrop-out' : 'motion-backdrop-in'}`}
      onMouseDown={requestClose}
    >
      <div
        className={`flex w-full justify-center ${nudging ? 'motion-nudge' : ''}`}
        onAnimationEnd={e => e.target === e.currentTarget && setNudging(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={`relative w-full ${wide === 'xl' ? 'max-w-6xl' : wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden ${closing ? 'motion-panel-out' : 'motion-panel-in'}`}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-base font-bold">{title}</h2>
            <button onClick={requestClose} disabled={locked} className="btn btn-ghost btn-sm !p-1.5" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </div>
      </div>
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}

// ---------- Confirm Modal ----------
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isPending = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
  isPending?: boolean
}) {
  const { mounted, closing } = usePresence(open, MODAL_EXIT_MS)
  useScrollLock(mounted)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !isPending && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isPending, onClose])

  if (!mounted) return null

  const variantStyles = {
    danger: {
      btn: 'bg-rose-600 hover:bg-rose-700 text-white',
      badge: 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/50',
    },
    warning: {
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
      badge: 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/50',
    },
    primary: {
      btn: 'bg-primary hover:bg-primary-hover text-white',
      badge: 'bg-primary/10 text-primary ring-8 ring-primary/5',
    },
  }[variant]

  const content = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs ${closing ? 'motion-backdrop-out' : 'motion-backdrop-in'}`}
      onMouseDown={isPending ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-sm rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-2xl ${closing ? 'motion-panel-out' : 'motion-panel-in'}`}
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isPending}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${variantStyles.badge}`}>
            <AlertTriangle size={24} />
          </div>

          <h3 className="text-base font-bold text-slate-900">
            {title}
          </h3>

          <div className="mt-2 text-xs leading-relaxed text-slate-500">
            {message}
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 ${variantStyles.btn}`}
            >
              {isPending && <Spinner size={13} />}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}

// ---------- Run a server action with loading + error ----------
// `success` shows a toast once the server confirms the save.
// `key` marks which button started the save, so only that one shows a spinner (see isPending),
// and isSaved(key) stays true for a moment afterwards so the button can show a "Saved" tick.
export type RunOptions<T> = { success?: string | ((data?: T) => string); key?: string }

export function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const busy = useRef(false)
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onDone?: (data?: T) => void, opts?: RunOptions<T>) => {
    // Ignore double clicks while a save is still running
    if (busy.current) return
    busy.current = true
    setError(null)
    setSavedKey(null)
    setPendingKey(opts?.key ?? null)
    start(async () => {
      try {
        const res = await fn()
        if (!res.ok) {
          setError(res.error)
          toast.error(res.error)
        } else {
          const msg = typeof opts?.success === 'function' ? opts.success(res.data) : opts?.success
          if (msg) toast.success(msg)
          if (opts?.key) {
            setSavedKey(opts.key)
            clearTimeout(savedTimer.current)
            savedTimer.current = setTimeout(() => setSavedKey(null), 1800)
          }
          onDone?.(res.data)
          router.refresh()
        }
      } catch {
        const msg = 'Could not reach the server. Check your connection and try again.'
        setError(msg)
        toast.error(msg)
      } finally {
        busy.current = false
      }
    })
  }
  useEffect(() => () => clearTimeout(savedTimer.current), [])
  const isPending = (key: string) => pending && pendingKey === key
  const isSaved = (key: string) => !pending && savedKey === key
  return { run, pending, isPending, isSaved, error, setError }
}

// Button content that shows a spinner while saving and a popping tick just after
export function SaveLabel({ pending, saved, label, savedLabel = 'Saved', size = 14 }: { pending: boolean; saved: boolean; label: React.ReactNode; savedLabel?: string; size?: number }) {
  if (saved) return <><Check size={size} strokeWidth={2.5} className="motion-check-pop" /> {savedLabel}</>
  return <>{pending && <Spinner size={size} />} {label}</>
}

// Errors show as a toast (not inline). Kept as a component so every screen that
// has an error to show just renders <ErrorNote error={…} />.
export function ErrorNote({ error }: { error?: string | null }) {
  useEffect(() => {
    if (error) toast.error(error)
  }, [error])
  return null
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin shrink-0 text-current ${className}`} />
}

// ---------- Empty state ----------
export function EmptyState({ icon, title, text, children }: { icon?: React.ReactNode; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

// ---------- Pagination (links keep the other URL filters) ----------
export function Pagination({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const href = (p: number) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v && k !== 'page' && q.set(k, v))
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      <Link href={href(page - 1)} className={`btn btn-secondary btn-sm ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`} aria-disabled={page <= 1}>
        <ChevronLeft size={16} /> Previous
      </Link>
      <span className="font-medium text-slate-600">
        Page {page} of {pages}
      </span>
      <Link href={href(page + 1)} className={`btn btn-secondary btn-sm ${page >= pages ? 'pointer-events-none opacity-40' : ''}`} aria-disabled={page >= pages}>
        Next <ChevronRight size={16} />
      </Link>
    </div>
  )
}

// ---------- Multi-select chips (services) ----------
export function ChipSelect({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value.includes(o)
        return (
          <button type="button" key={o} className={`chip ${on ? 'active' : ''}`} onClick={() => onChange(on ? value.filter(v => v !== o) : [...value, o])}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Info tip: an "i" icon that explains something on hover or focus ----------
export function InfoTip({ text, align = 'center' }: { text: string; align?: 'center' | 'left' | 'right' }) {
  const pos = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <span className="group relative inline-flex align-middle">
      {/* A span, not a button, so it can sit inside clickable cards */}
      <span tabIndex={0} role="img" aria-label={text} onClick={e => e.stopPropagation()}
        className="inline-flex cursor-help text-slate-400 hover:text-slate-600 focus:text-slate-600 focus:outline-none">
        <Info size={13} />
      </span>
      <span role="tooltip" className={`pointer-events-none absolute bottom-full z-30 mb-1.5 w-max max-w-60 rounded-md bg-slate-900 px-2 py-1 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${pos}`}>
        {text}
      </span>
    </span>
  )
}
