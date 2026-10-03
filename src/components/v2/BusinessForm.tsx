'use client'

// Add a business (saved as "Needs review") or edit an existing one.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CONFIG } from '@/lib/config'
import { EMAIL_RE, phoneLooksValid } from '@/lib/importFields'
import { updateBusiness } from '@/app/dashboard/actions'
import { ChipSelect, ErrorNote, Modal, Spinner } from '@/components/ui'

export type BusinessValues = Partial<Record<
  | 'business_name' | 'business_type' | 'tier' | 'room_count' | 'area' | 'address' | 'postcode' | 'maps_link' | 'phone'
  | 'whatsapp_number' | 'email' | 'instagram' | 'facebook' | 'existing_website' | 'company_type' | 'contact_name' | 'notes',
  string | null
>>

type Dup = { business_id: string; business_name: string; matched_by: string; open_pitches: number }

export function BusinessForm({
  open, onClose, mode, businessId, initial,
}: { open: boolean; onClose: () => void; mode: 'add' | 'edit'; businessId?: string; initial?: BusinessValues }) {
  const router = useRouter()
  const [v, setV] = useState<BusinessValues>(() => ({ company_type: 'Unknown', ...(initial || {}) }))
  const [services, setServices] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dup, setDup] = useState<Dup | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const set = (k: keyof BusinessValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV(prev => ({ ...prev, [k]: e.target.value }))

  const isAccommodation = CONFIG.BUSINESS_CATEGORIES.Accommodation.includes(v.business_type || '')

  const validate = () => {
    const e: Record<string, string> = {}
    if (!v.business_name?.trim()) e.business_name = 'Required'
    if (!v.business_type) e.business_type = 'Required'
    if (mode === 'add' && !services.length) e.services = 'Pick at least one'
    if (v.email && !EMAIL_RE.test(v.email.trim())) e.email = 'Looks wrong'
    if (v.phone && !phoneLooksValid(v.phone)) e.phone = 'Looks wrong'
    if (v.whatsapp_number && !phoneLooksValid(v.whatsapp_number)) e.whatsapp_number = 'Looks wrong'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const payload = (action: string, existingId?: string) => ({
    idx: 0, action, existing_id: existingId, services,
    ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, typeof val === 'string' ? val.trim() : val ?? ''])),
  })

  const importRow = async (action: string, existingId?: string) => {
    const res = await fetch('/api/leads/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [payload(action, existingId)] }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Could not save')
    if (json.failed) throw new Error(json.errors?.[0]?.message || 'Could not save')
    return json
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setBusy(true)
    try {
      if (mode === 'edit' && businessId) {
        const res = await updateBusiness(businessId, v as Record<string, string | null>)
        if (!res.ok) throw new Error(res.error)
        router.refresh()
        onClose()
        return
      }
      // Check for an existing business first
      const d = await fetch('/api/leads/duplicates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ idx: 0, business_name: v.business_name, phone: v.phone, email: v.email, postcode: v.postcode }] }),
      }).then(r => r.json())
      if (d.error) throw new Error(d.error)
      if (d.matches?.length) {
        setDup(d.matches[0])
        return
      }
      await importRow('new')
      setDone('Saved. It is now in the review queue.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const resolveDup = async (action: 'new_pitch' | 'update') => {
    if (!dup) return
    setBusy(true)
    setError(null)
    try {
      await importRow(action, dup.business_id)
      setDone(action === 'new_pitch' ? 'New pitch added to the existing business. It is in the review queue.' : 'Existing business updated.')
      setDup(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof BusinessValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className={`input ${errors[k] ? '!border-red-400' : ''}`} value={v[k] ?? ''} onChange={set(k)} {...props} />
      {errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>}
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={mode === 'add' ? 'Add business' : 'Edit details'} wide>
      {done ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{done}</div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button className="btn btn-secondary w-full sm:w-auto" onClick={() => { setDone(null); setV({ company_type: 'Unknown' }); setServices([]) }}>Add another</button>
            <button className="btn btn-primary w-full sm:w-auto" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : dup ? (
        <div className="space-y-4">
          <p className="text-sm">
            <b>{dup.business_name}</b> is already in the system (same {dup.matched_by}).
            {dup.open_pitches > 0 && ` It has ${dup.open_pitches} open pitch(es).`} What would you like to do?
          </p>
          <ErrorNote error={error} />
          <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-2">
            <button className="btn btn-secondary w-full sm:w-auto" onClick={() => setDup(null)} disabled={busy}>Go back</button>
            <button className="btn btn-secondary w-full sm:w-auto" onClick={() => resolveDup('update')} disabled={busy}>Update its details</button>
            <button className="btn btn-primary w-full sm:w-auto" onClick={() => resolveDup('new_pitch')} disabled={busy || !services.length}>
              {busy && <Spinner />} Add a new pitch to it
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {field('business_name', 'Business name *', { autoFocus: true })}
            <div>
              <label className="label">Business type *</label>
              <select className={`input ${errors.business_type ? '!border-red-400' : ''}`} value={v.business_type ?? ''} onChange={set('business_type')}>
                <option value="">Choose…</option>
                {Object.entries(CONFIG.BUSINESS_CATEGORIES).map(([group, types]) => (
                  <optgroup key={group} label={group}>
                    {types.map(t => <option key={t}>{t}</option>)}
                  </optgroup>
                ))}
              </select>
              {errors.business_type && <p className="mt-1 text-xs text-red-600">{errors.business_type}</p>}
            </div>
          </div>

          {mode === 'add' && (
            <div>
              <label className="label">Services to pitch *</label>
              <ChipSelect options={CONFIG.SERVICES} value={services} onChange={setServices} />
              {errors.services && <p className="mt-1 text-xs text-red-600">{errors.services}</p>}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">How to reach them</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {field('phone', 'Phone', { inputMode: 'tel', placeholder: '07… or 020…' })}
              {field('whatsapp_number', 'WhatsApp (if different)', { inputMode: 'tel' })}
              {field('email', 'Email', { type: 'email' })}
              {field('contact_name', 'Contact name')}
              {field('instagram', 'Instagram handle', { placeholder: 'without @' })}
              {field('facebook', 'Facebook page')}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Where and what</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
              {field('area', 'Area', { placeholder: 'e.g. Richmond' })}
              {field('postcode', 'Postcode')}
              {field('address', 'Address')}
              {field('existing_website', 'Current website')}
              {field('maps_link', 'Google Maps link')}
              <div>
                <label className="label">Company type</label>
                <select className="input" value={v.company_type ?? 'Unknown'} onChange={set('company_type')}>
                  {CONFIG.COMPANY_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
                {(v.company_type === 'Sole trader' || v.company_type === 'Partnership') && (
                  <p className="mt-1 text-xs text-amber-700">Marketing emails need their consent first (PECR).</p>
                )}
              </div>
              {isAccommodation && (
                <>
                  <div>
                    <label className="label">Tier</label>
                    <select className="input" value={v.tier ?? ''} onChange={set('tier')}>
                      <option value="">Not known</option>
                      {CONFIG.TIERS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {field('room_count', 'Rooms', { inputMode: 'numeric' })}
                </>
              )}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-20" value={v.notes ?? ''} onChange={set('notes')} />
          </div>

          <ErrorNote error={error} />
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>
              {busy && <Spinner />} {mode === 'add' ? 'Save to review queue' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
