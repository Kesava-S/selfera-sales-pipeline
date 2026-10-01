'use client'

// Small shared pieces used across the dashboard
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle, Camera, ThumbsUp, Mail, Phone, Footprints, X, Loader2, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { STAGE_STYLE, STATUS_STYLE } from '@/lib/config'
import type { ActionResult } from '@/app/dashboard/actions'

// ---------- Platform icon ----------
const PLATFORM_ICON: Record<string, { Icon: typeof Mail; color: string }> = {
  WhatsApp: { Icon: MessageCircle, color: 'text-green-600' },
  Instagram: { Icon: Camera, color: 'text-pink-600' },
  Facebook: { Icon: ThumbsUp, color: 'text-blue-600' },
  Email: { Icon: Mail, color: 'text-sky-700' },
  Phone: { Icon: Phone, color: 'text-amber-700' },
  'Walk-in': { Icon: Footprints, color: 'text-teal-700' },
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
export function Modal({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-2xl bg-white shadow-xl`}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm !p-1.5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ---------- Run a server action with loading + error ----------
export function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onDone?: (data?: T) => void) => {
    setError(null)
    start(async () => {
      try {
        const res = await fn()
        if (!res.ok) setError(res.error)
        else {
          onDone?.(res.data)
          router.refresh()
        }
      } catch {
        setError('Could not reach the server. Check your connection and try again.')
      }
    })
  }
  return { run, pending, error, setError }
}

export function ErrorNote({ error }: { error?: string | null }) {
  if (!error) return null
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" />
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
