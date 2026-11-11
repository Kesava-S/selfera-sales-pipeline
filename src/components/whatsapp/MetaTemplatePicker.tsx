'use client'

// Pick one of this product's approved Meta templates (WhatsApp campaigns).
// Templates are created and approved in Templates → WhatsApp.

import { useEffect, useState } from 'react'
import { ourApprovedMetaTemplates } from '@/app/dashboard/templates/metaActions'

export function MetaTemplatePicker({ value, onChange, className = '', allowNone = true }: {
  value: string
  onChange: (name: string) => void
  className?: string
  allowNone?: boolean
}) {
  const [list, setList] = useState<{ name: string; language: string; body: string }[] | null>(null)
  useEffect(() => {
    let live = true
    ourApprovedMetaTemplates().then(r => { if (live) setList(r.ok ? r.data ?? [] : []) })
    return () => { live = false }
  }, [])
  const picked = list?.find(t => t.name === value)
  return (
    <div className="space-y-1">
      <select className={`input ${className}`} value={value} onChange={e => onChange(e.target.value)} disabled={!list}>
        {allowNone && <option value="">{list ? 'Default template (from Integrations)' : 'Loading…'}</option>}
        {!allowNone && <option value="" disabled>{list ? 'Choose an approved template' : 'Loading…'}</option>}
        {list?.map(t => <option key={`${t.name}-${t.language}`} value={t.name}>{t.name} ({t.language})</option>)}
        {value && list && !picked && <option value={value}>{value} · not approved in this product</option>}
      </select>
      {picked && <p className="line-clamp-2 text-[11px] text-slate-500">{picked.body}</p>}
      {list && list.length === 0 && <p className="text-[11px] text-amber-700">No approved Meta templates yet. Create one in Templates → WhatsApp.</p>}
      {value && list && !picked && <p className="text-[11px] text-red-600">This template can&apos;t be sent. Pick an approved one.</p>}
    </div>
  )
}
