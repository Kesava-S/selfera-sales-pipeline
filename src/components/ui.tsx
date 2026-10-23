'use client'

// Small shared pieces used across the dashboard
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
export { Preloader, LogoPreloader, ButtonSpinner, CircleLoader } from '@/components/Preloader'
export { toast, ToastContainer } from '@/components/v2/Toast'
import { toast } from '@/components/v2/Toast'
import { MessageCircle, Camera, ThumbsUp, Mail, X, Loader2, ChevronLeft, ChevronRight, Layers, Check } from 'lucide-react'
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
  WhatsApp: { Icon: MessageCircle, color: 'text-green-600' },
  Instagram: { Icon: Camera, color: 'text-pink-600' },
  Facebook: { Icon: ThumbsUp, color: 'text-blue-600' },
  Email: { Icon: Mail, color: 'text-sky-700' },
  LinkedIn: { Icon: LinkedinIcon, color: 'text-[#0a66c2]' },
  All: { Icon: Layers, color: 'text-slate-500' },
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

export function Modal({ title, open, onClose, children, wide, locked }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean; locked?: boolean }) {
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

  useEffect(() => {
    if (!mounted) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [mounted])

  if (!mounted) return null
  return (
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
          className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden ${closing ? 'motion-panel-out' : 'motion-panel-in'}`}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-base font-bold">{title}</h2>
            <button onClick={requestClose} disabled={locked} className="btn btn-ghost btn-sm !p-1.5" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </div>
      </div>
    </div>
  )
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

export function ErrorNote({ error }: { error?: string | null }) {
  if (!error) return null
  // Keyed by message, so a new error slides in again
  return <div key={error} role="alert" className="motion-error-in rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 break-words whitespace-normal leading-snug">{error}</div>
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
