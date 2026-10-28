'use client'

// "Columns" menu for long lists: the key columns show by default and the rest can
// be ticked on. Each person's choice is remembered in this browser.

import { useEffect, useRef, useState } from 'react'
import { Columns3 } from 'lucide-react'

export type ColumnDef = { key: string; label: string; default?: boolean }

export function useColumns(storageKey: string, columns: ColumnDef[]) {
  const defaults = columns.filter(c => c.default).map(c => c.key)
  const [shown, setShown] = useState<string[]>(defaults)

  // Read the saved choice after mount (the server has no browser storage)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setShown(saved.filter((k: unknown) => columns.some(c => c.key === k)))
    } catch {
      // Private window or blocked storage: keep the defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const update = (next: string[]) => {
    setShown(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* not saved, still applied */ }
  }
  return {
    has: (key: string) => shown.includes(key),
    shown,
    toggle: (key: string) => update(shown.includes(key) ? shown.filter(k => k !== key) : [...shown, key]),
    reset: () => update(defaults),
  }
}

export function ColumnPicker({ columns, state }: { columns: ColumnDef[]; state: ReturnType<typeof useColumns> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const extra = state.shown.filter(k => !columns.find(c => c.key === k)?.default).length
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <Columns3 size={14} /> Columns{extra ? ` (+${extra})` : ''}
      </button>
      {open && (
        <div className="motion-dropdown-in absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {columns.map(c => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={state.has(c.key)} onChange={() => state.toggle(c.key)} />
              {c.label}
            </label>
          ))}
          <button type="button" className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-primary hover:bg-slate-50" onClick={state.reset}>
            Show only the key columns
          </button>
        </div>
      )}
    </div>
  )
}
