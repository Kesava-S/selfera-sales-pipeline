'use client'

// Add a business (saved as "Needs review") or edit an existing one.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CONFIG } from '@/lib/config'
import { categoryNames } from '@/lib/lists'
import { EMAIL_RE } from '@/lib/importFields'
import { parseAndValidatePhone } from '@/lib/contact'
import { updateBusiness } from '@/app/dashboard/actions'
import { ChipSelect, ErrorNote, Modal, Spinner, toast } from '@/components/ui'
import { PhoneInput } from '@/components/v2/PhoneInput'
import { useLists } from '@/components/ListsContext'

export type BusinessValues = Partial<Record<
  | 'business_name' | 'business_type' | 'tier' | 'room_count' | 'area' | 'address' | 'postcode' | 'maps_link'
  | 'whatsapp_number' | 'email' | 'instagram' | 'facebook' | 'linkedin' | 'existing_website' | 'has_no_website' | 'company_type' | 'contact_name'
  | 'owner_contact' | 'existing_tech_partner' | 'gaps_found' | 'notes',
  string | boolean | null
>>

type Dup = { business_id: string; business_name: string; matched_by: string; open_pitches: number }

export function BusinessForm({
  open, onClose, mode, businessId, initial,
}: { open: boolean; onClose: () => void; mode: 'add' | 'edit'; businessId?: string; initial?: BusinessValues }) {
  const lists = useLists()
  const router = useRouter()
  const [v, setV] = useState<BusinessValues>(() => ({ company_type: 'Unknown', ...(initial || {}) }))
  const [services, setServices] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dup, setDup] = useState<Dup | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const set = (k: keyof BusinessValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setV(prev => ({ ...prev, [k]: e.target.value }))
    if (errors[k]) setErrors(prev => { const next = { ...prev }; delete next[k]; return next })
    if (errors.contact && (k === 'email' || k === 'whatsapp_number' || k === 'instagram' || k === 'facebook' || k === 'linkedin' || k === 'owner_contact')) {
      setErrors(prev => { const next = { ...prev }; delete next.contact; return next })
    }
  }

  // Exactly 4 required checks:
  // 1. Business name
  // 2. Category: Hotel, Restaurant or cafe, Pub, or Property management
  // 3. Service to pitch: Website, Micro Automation, End-to-End Automation, Custom Dashboard, or Cold Outreach
  // 4. At least one contact: any one of email, WhatsApp, Instagram, Facebook or LinkedIn
  const validate = () => {
    const e: Record<string, string> = {}
    if (!v.business_name || !String(v.business_name).trim()) e.business_name = 'Business name is required'
    if (!v.business_type || !String(v.business_type).trim()) e.business_type = 'Category is required'
    if (mode === 'add' && !services.length) e.services = 'Pick at least one service to pitch'

    const hasContact = Boolean(
      (typeof v.email === 'string' && v.email.trim()) ||
      (typeof v.whatsapp_number === 'string' && v.whatsapp_number.trim()) ||
      (typeof v.instagram === 'string' && v.instagram.trim()) ||
      (typeof v.facebook === 'string' && v.facebook.trim()) ||
      (typeof v.linkedin === 'string' && v.linkedin.trim()) ||
      (typeof v.owner_contact === 'string' && v.owner_contact.trim())
    )
    if (!hasContact) {
      e.contact = 'At least one contact is required (Email, WhatsApp, Instagram, Facebook, or LinkedIn)'
    }

    if (v.email && typeof v.email === 'string' && v.email.trim() && !EMAIL_RE.test(v.email.trim())) {
      e.email = 'Email looks invalid'
    }
    if (v.whatsapp_number && typeof v.whatsapp_number === 'string' && v.whatsapp_number.trim()) {
      const w = parseAndValidatePhone(v.whatsapp_number.trim())
      if (!w.valid) e.whatsapp_number = w.error ? w.error.replace(/^Phone/, 'WhatsApp') : 'Must include country code (e.g. +44, 44, or 0...)'
    }

    setErrors(e)
    const errList = Object.values(e)
    if (errList.length > 0) {
      toast.error(errList[0], { title: 'Please check form' })
    }
    return errList.length === 0
  }

  const payload = (action: string, existingId?: string) => {
    const rawEntries = Object.entries(v).map(([k, val]) => {
      if (k === 'has_no_website') {
        return [k, Boolean(val)]
      }
      let trimmed = typeof val === 'string' ? val.trim() : val ?? ''
      if (k === 'whatsapp_number' && typeof trimmed === 'string' && trimmed) {
        const p = parseAndValidatePhone(trimmed)
        if (p.valid && p.normalized) trimmed = p.normalized
      }
      if (k === 'existing_website' && typeof trimmed === 'string' && trimmed) {
        if (!/^https?:\/\//i.test(trimmed)) trimmed = 'https://' + trimmed
      }
      return [k, trimmed]
    })
    return {
      idx: 0,
      action,
      existing_id: existingId,
      services,
      ...Object.fromEntries(rawEntries),
    }
  }

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
        const editData = { ...v }
        if (typeof editData.whatsapp_number === 'string' && editData.whatsapp_number) {
          const w = parseAndValidatePhone(editData.whatsapp_number)
          if (w.valid) editData.whatsapp_number = w.normalized
        }
        if (editData.has_no_website) {
          editData.existing_website = null
        } else if (typeof editData.existing_website === 'string' && editData.existing_website.trim()) {
          const site = editData.existing_website.trim()
          if (!/^https?:\/\//i.test(site)) editData.existing_website = 'https://' + site
        }
        const res = await updateBusiness(businessId, editData as Record<string, string | number | null>)
        if (!res.ok) throw new Error(res.error)
        toast.success('Business details updated successfully.')
        router.refresh()
        onClose()
        return
      }
      // Check for an existing business first
      const d = await fetch('/api/leads/duplicates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            idx: 0,
            business_name: v.business_name,
            whatsapp_number: v.whatsapp_number,
            email: v.email,
            postcode: v.postcode,
          }],
        }),
      }).then(r => r.json())
      if (d.error) throw new Error(d.error)
      if (d.matches?.length) {
        setDup(d.matches[0])
        return
      }
      await importRow('new')
      const successMsg = 'Business added! It is now in the review queue.'
      setDone(successMsg)
      toast.success(successMsg)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save'
      setError(msg)
      toast.error(msg)
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
      const successMsg = action === 'new_pitch' ? 'New pitch added to the existing business. It is in the review queue.' : 'Existing business updated.'
      setDone(successMsg)
      toast.success(successMsg)
      setDup(null)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const renderLabel = (label: string) => {
    if (label.endsWith(' *')) {
      return (
        <>
          {label.slice(0, -2)} <span className="text-red-500 font-bold ml-0.5">*</span>
        </>
      )
    }
    return label
  }

  const field = (k: keyof BusinessValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label">{renderLabel(label)}</label>
      <input className={`input ${errors[k] ? '!border-red-400' : ''}`} value={(v[k] as string) ?? ''} onChange={set(k)} {...props} />
      {errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>}
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} locked={busy} title={mode === 'add' ? 'Add business' : 'Edit details'} wide>
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
        <form onSubmit={submit} className="space-y-6">
          {/* Required Fields Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {field('business_name', 'Business name *', { autoFocus: true, placeholder: 'e.g. The Grand Hotel' })}
              <div>
                <label className="label">Category <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <select
                  className={`input ${errors.business_type ? '!border-red-400' : ''}`}
                  value={(v.business_type as string) ?? ''}
                  onChange={set('business_type')}
                >
                  <option value="">Choose category…</option>
                  {categoryNames(lists).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {typeof v.business_type === 'string' && v.business_type && !categoryNames(lists).includes(v.business_type) && (
                    <option value={v.business_type}>{v.business_type}</option>
                  )}
                </select>
                {errors.business_type && <p className="mt-1 text-xs text-red-600">{errors.business_type}</p>}
              </div>
              <div>
                <label className="label">Company type</label>
                <select
                  className="input"
                  value={(v.company_type as string) ?? 'Unknown'}
                  onChange={set('company_type')}
                >
                  {CONFIG.COMPANY_TYPES.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'add' && (
              <div>
                <label className="label">Service to pitch <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <ChipSelect options={lists.services} value={services} onChange={setServices} />
                {errors.services && <p className="mt-1 text-xs text-red-600">{errors.services}</p>}
              </div>
            )}
          </div>

          {/* Contact Details Section (At least 1 required) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Contact Details <span className="text-red-500 font-bold ml-0.5">*</span></p>
              <span className="text-xs text-slate-500">Provide at least one: Email, WhatsApp, Instagram, or Facebook</span>
            </div>

            {errors.contact && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                {errors.contact}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {field('email', 'Business Email', { type: 'email', placeholder: 'hello@business.com' })}
              <div>
                <label className="label">Business WhatsApp</label>
                <PhoneInput
                  value={(v.whatsapp_number as string) ?? ''}
                  onChange={val => {
                    setV(prev => ({ ...prev, whatsapp_number: val }))
                    if (errors.whatsapp_number) {
                      setErrors(prev => { const next = { ...prev }; delete next.whatsapp_number; return next })
                    }
                    if (errors.contact) {
                      setErrors(prev => { const next = { ...prev }; delete next.contact; return next })
                    }
                  }}
                  error={errors.whatsapp_number}
                />
                {errors.whatsapp_number && <p className="mt-1 text-xs text-red-600">{errors.whatsapp_number}</p>}
              </div>
              {field('instagram', 'Business Instagram', { placeholder: 'handle without @' })}
              {field('facebook', 'Business Facebook', { placeholder: 'Page link or handle' })}
              {field('linkedin', 'Business LinkedIn', { placeholder: 'linkedin.com/company/… or profile' })}
            </div>

            <div className="border-t border-slate-200 pt-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Owner Details (Optional)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {field('contact_name', 'Owner name', { placeholder: 'e.g. John Doe' })}
                {field('owner_contact', 'Owner contact', { placeholder: 'Email, WhatsApp, LinkedIn or socials' })}
              </div>
            </div>
          </div>

          {/* Online Presence & Location Section */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Website & Location (Optional)</p>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="sm:col-span-2">
                  <label className="label">Website link</label>
                  <input
                    className={`input ${v.has_no_website ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                    placeholder="https://example.com"
                    value={v.has_no_website ? '' : ((v.existing_website as string) ?? '')}
                    onChange={set('existing_website')}
                    disabled={Boolean(v.has_no_website)}
                  />
                </div>
                <div className="pt-1 sm:pt-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                      checked={Boolean(v.has_no_website)}
                      onChange={e => {
                        const checked = e.target.checked
                        setV(prev => ({
                          ...prev,
                          has_no_website: checked,
                          existing_website: checked ? null : prev.existing_website,
                        }))
                      }}
                    />
                    Tick &ldquo;No site&rdquo;
                  </label>
                </div>
              </div>
              {v.has_no_website && (
                <p className="mt-1 text-xs text-amber-700 font-medium">Marked as having no website.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Address / Location</label>
                <input
                  className="input"
                  placeholder="e.g. 10 High Street, London"
                  value={(v.address as string) ?? ''}
                  onChange={set('address')}
                />
              </div>
              <div>
                <label className="label">Postcode</label>
                <input
                  className="input"
                  placeholder="e.g. SW1A 1AA"
                  value={(v.postcode as string) ?? ''}
                  onChange={e => setV(prev => ({ ...prev, postcode: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
          </div>

          {/* Tech & Audit Gaps Section */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tech & Audit (Optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="label">Existing tech partner</label>
                <input
                  className="input"
                  placeholder="Agency (name it), DIY (tool e.g. Wix), or None"
                  value={(v.existing_tech_partner as string) ?? ''}
                  onChange={set('existing_tech_partner')}
                />
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span>Quick pick:</span>
                  <button type="button" className="font-semibold text-primary hover:opacity-75 transition-opacity" onClick={() => setV(p => ({ ...p, existing_tech_partner: 'None' }))}>None</button>
                  <span>·</span>
                  <button type="button" className="font-semibold text-primary hover:opacity-75 transition-opacity" onClick={() => setV(p => ({ ...p, existing_tech_partner: 'DIY (Wix)' }))}>DIY (Wix)</button>
                  <span>·</span>
                  <button type="button" className="font-semibold text-primary hover:opacity-75 transition-opacity" onClick={() => setV(p => ({ ...p, existing_tech_partner: 'Agency' }))}>Agency</button>
                </div>
              </div>
              <div>
                <label className="label">Gaps found</label>
                <textarea
                  className="input min-h-20"
                  placeholder="Free text: no online booking, slow site, no follow-up automation..."
                  value={(v.gaps_found as string) ?? ''}
                  onChange={set('gaps_found')}
                />
              </div>
            </div>

            <div>
              <label className="label">Additional notes</label>
              <textarea
                className="input min-h-16"
                placeholder="Any extra comments or observations"
                value={(v.notes as string) ?? ''}
                onChange={set('notes')}
              />
            </div>
          </div>

          <ErrorNote error={error} />
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>
              {busy && <Spinner />} {mode === 'add' ? 'Save to review queue' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
