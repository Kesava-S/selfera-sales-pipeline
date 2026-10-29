'use client'

// Client Audience: one client's customers. Tabs split them into ready,
// missing data and do not contact; filters and paging live in the URL.

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, Ban, CheckCircle2, Contact, Download, MessageCircle, Phone, Plus, Search, Trash2, Undo2, Upload, X } from 'lucide-react'
import { approveCustomerImport, deleteAudience, deleteCustomerLeads, saveCustomerLead, setCustomerDoNotContact, undoCustomerImport } from '@/app/dashboard/audience/actions'
import { ColumnPicker, useColumns, type ColumnDef } from '@/components/ColumnPicker'
import {
  checkPhone, missingFor, COUNTRIES, PHONE_TYPE_LABEL,
  type Country, type CustomerInput, type CustomerLead, type PhoneType,
} from '@/lib/customerLeads'
import { EmptyState, ErrorNote, Modal, Pagination, Spinner, useAction } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/customers/ClientsView'
import { CustomerImportModal } from '@/components/customers/CustomerImportModal'

export type CustomerTab = 'all' | 'ready' | 'missing' | 'dnc'
export type CustomerFilters = { tab: CustomerTab; q: string; phone: string; country: string }
type Counts = { total: number; ready: number; missing: number; do_not_contact: number; whatsapp: number; test: number }
type Business = { id: string; business_name: string; contact_name: string | null; business_type: string | null; area: string | null }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export type PendingImport = { id: string; file_name: string | null; created_count: number; created_at: string; created_by: string | null }

// The key columns show by default; the rest can be ticked on
const COLUMNS: ColumnDef[] = [
  { key: 'phone', label: 'Phone / WhatsApp', default: true },
  { key: 'email', label: 'Email', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'town', label: 'Town / postcode' },
  { key: 'tags', label: 'Tags' },
  { key: 'visit', label: 'Last visit / purchase' },
  { key: 'birthday', label: 'Birthday month' },
  { key: 'country', label: 'Country' },
  { key: 'consent', label: 'Consent confirmed' },
  { key: 'added', label: 'Added' },
]

export function CustomersView({ business, customers, total, counts, filters, page, pageSize, view = 'customers', isAdmin = false, meId, pendingImports = [], children }: {
  business: Business; customers: CustomerLead[]; total: number; counts: Counts; filters: CustomerFilters; page: number; pageSize: number
  view?: 'customers' | 'campaigns'; isAdmin?: boolean; meId?: string; pendingImports?: PendingImport[]; children?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [navigating, startNav] = useTransition()
  const [q, setQ] = useState(filters.q)
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<CustomerLead | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirm, setConfirm] = useState<null | 'delete' | 'dnc'>(null)
  const [reason, setReason] = useState('')
  const bulk = useAction()
  const imports = useAction()
  const cols = useColumns('audience-columns', COLUMNS)
  const [deletingAll, setDeletingAll] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const exportHref = `/api/audience/export?${new URLSearchParams({ business: business.id, tab: filters.tab, q: filters.q, phone: filters.phone, country: filters.country })}`

  const setFilter = (patch: Partial<CustomerFilters>) => {
    const next = { ...filters, ...patch }
    const p = new URLSearchParams()
    Object.entries(next).forEach(([k, v]) => v && !(k === 'tab' && v === 'all') && p.set(k, v))
    setSelected([])
    startNav(() => router.replace(p.toString() ? `${pathname}?${p}` : pathname, { scroll: false }))
  }

  const tabs: { key: CustomerTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.total - counts.do_not_contact },
    { key: 'ready', label: 'Ready', count: counts.ready },
    { key: 'missing', label: 'Missing data', count: counts.missing },
    { key: 'dnc', label: 'Do not contact', count: counts.do_not_contact },
  ]
  const allOnPage = customers.length > 0 && customers.every(c => selected.includes(c.id))
  const filtered = !!(filters.q || filters.phone || filters.country)
  const closeConfirm = () => { setConfirm(null); setReason(''); bulk.setError(null) }

  return (
    <div className="space-y-5">
      <PageHeader
        title={business.business_name}
        text={`${[business.contact_name && `Owner: ${business.contact_name}`, business.business_type, business.area].filter(Boolean).join(' · ') || 'Client'} · ${counts.total.toLocaleString('en-GB')} customers`}
      >
        {isAdmin && view === 'customers' && <a href={exportHref} className="btn btn-secondary"><Download size={16} /> Export CSV</a>}
        <button className="btn btn-secondary" onClick={() => setImporting(true)}><Upload size={16} /> Import CSV</button>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add customer</button>
      </PageHeader>

      <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100 p-1 text-sm font-semibold">
        {(['customers', 'campaigns'] as const).map(v => (
          <Link key={v} href={v === 'customers' ? pathname : `${pathname}?view=campaigns`} scroll={false}
            className={`rounded-lg px-4 py-1.5 transition-colors ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {v === 'customers' ? 'Customers' : 'Campaigns'}
          </Link>
        ))}
      </div>

      {pendingImports.map(b => (
        <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              <b>{b.file_name || 'Import'}</b> ({b.created_count.toLocaleString('en-GB')} added, {formatDate(b.created_at)}) is waiting for an admin to approve the client&apos;s consent.
              These customers aren&apos;t included in campaigns until then.
            </span>
          </span>
          <span className="flex gap-2">
            {(isAdmin || b.created_by === meId) && (
              <button className="btn btn-ghost btn-sm" disabled={imports.pending} onClick={() => {
                if (window.confirm(`Undo this import? The ${b.created_count} customers it added are removed. Customers it only updated stay.`)) {
                  imports.run(() => undoCustomerImport(business.id, b.id), undefined, { success: n => `Import undone: ${n} customers removed.`, key: `undo-${b.id}` })
                }
              }}>
                {imports.isPending(`undo-${b.id}`) ? <Spinner size={14} /> : <Undo2 size={14} />} Undo import
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-primary btn-sm" disabled={imports.pending} onClick={() => imports.run(() => approveCustomerImport(business.id, b.id), undefined, { success: 'Import approved.', key: `ok-${b.id}` })}>
                {imports.isPending(`ok-${b.id}`) ? <Spinner size={14} /> : <CheckCircle2 size={14} />} Approve
              </button>
            )}
          </span>
        </div>
      ))}
      <ErrorNote error={imports.error} />

      {view === 'campaigns' ? children : (<>
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter({ tab: t.key })}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${filters.tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label} <span className={`rounded-full px-2 py-0.5 text-xs ${filters.tab === t.key ? 'bg-primary-bg' : 'bg-slate-100'}`}>{t.count.toLocaleString('en-GB')}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="relative min-w-56 flex-1 sm:max-w-sm" onSubmit={e => { e.preventDefault(); setFilter({ q: q.trim() }) }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Name, email, phone, town" value={q} onChange={e => setQ(e.target.value)} onBlur={() => q.trim() !== filters.q && setFilter({ q: q.trim() })} />
        </form>
        <select className="input !w-auto" value={filters.phone} onChange={e => setFilter({ phone: e.target.value })}>
          <option value="">Any phone</option>
          <option value="mobile">Mobile</option>
          <option value="landline">Landline</option>
          <option value="invalid">Invalid number</option>
          <option value="none">No phone</option>
        </select>
        <select className="input !w-auto" value={filters.country} onChange={e => setFilter({ country: e.target.value })}>
          <option value="">UK and India</option>
          <option value="UK">UK</option>
          <option value="India">India</option>
        </select>
        {filtered && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setFilter({ q: '', phone: '', country: '' }) }}><X size={14} /> Clear</button>}
        {navigating && <Spinner size={14} className="text-slate-400" />}
        <span className="ml-auto"><ColumnPicker columns={COLUMNS} state={cols} /></span>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-border bg-primary-bg px-3 py-2 text-sm">
          <b className="text-primary">{selected.length} selected</b>
          <div className="ml-auto flex flex-wrap gap-2">
            {filters.tab === 'dnc' ? (
              <button className="btn btn-secondary btn-sm" disabled={bulk.pending} onClick={() => bulk.run(() => setCustomerDoNotContact(business.id, selected, false), () => setSelected([]), { success: n => `${n} can be contacted again.` })}>
                <Undo2 size={14} /> Allow contact again
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm('dnc')}><Ban size={14} /> Do not contact</button>
            )}
            <button className="btn btn-secondary btn-sm !text-red-700" onClick={() => setConfirm('delete')}><Trash2 size={14} /> Delete</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Cancel</button>
          </div>
        </div>
      )}

      {customers.length === 0 ? (
        counts.total === 0 ? (
          <EmptyState icon={<Contact size={40} />} title="No customers yet" text="Add customers one by one, or import the CSV the client gave you.">
            <button className="btn btn-secondary" onClick={() => setImporting(true)}><Upload size={16} /> Import CSV</button>
            <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add customer</button>
          </EmptyState>
        ) : (
          <EmptyState title={filtered ? 'No customers match these filters' : 'Nothing here'} text={filters.tab === 'missing' && !filtered ? 'Every customer has what they need.' : undefined} />
        )
      ) : (
        <div className={`table-wrap transition-opacity ${navigating ? 'opacity-60' : ''}`}>
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input type="checkbox" aria-label="Select all on this page" checked={allOnPage}
                    onChange={() => setSelected(allOnPage ? selected.filter(id => !customers.some(c => c.id === id)) : [...new Set([...selected, ...customers.map(c => c.id)])])} />
                </th>
                <th>Customer</th>
                {cols.has('phone') && <th>Phone / WhatsApp</th>}
                {cols.has('email') && <th>Email</th>}
                {cols.has('status') && <th>{filters.tab === 'dnc' ? 'Reason' : 'Status'}</th>}
                {cols.has('town') && <th>Town</th>}
                {cols.has('tags') && <th>Tags</th>}
                {cols.has('visit') && <th>Last visit</th>}
                {cols.has('birthday') && <th>Birthday</th>}
                {cols.has('country') && <th>Country</th>}
                {cols.has('consent') && <th>Consent</th>}
                {cols.has('added') && <th>Added</th>}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const missing = missingFor(c)
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
                return (
                  <tr key={c.id} className="cursor-pointer" onClick={() => setEditing(c)}>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${name || c.email || c.phone}`} checked={selected.includes(c.id)}
                        onChange={() => setSelected(selected.includes(c.id) ? selected.filter(x => x !== c.id) : [...selected, c.id])} />
                    </td>
                    <td className="max-w-64">
                      <div className="flex items-center gap-1.5">
                        <span className={`truncate font-semibold ${name ? 'text-slate-900' : 'italic text-slate-400'}`}>{name || 'No name'}</span>
                        {c.country === 'India' && <span className="badge !border-violet-200 !bg-violet-50 !py-0 !text-[10px] !text-violet-700">India</span>}
                      </div>
                    </td>
                    {cols.has('phone') && <td>
                      <PhoneCell raw={c.phone} e164={c.phone_e164} type={c.phone_type} whatsapp={c.whatsapp_status} />
                      {c.phone2 && <PhoneCell raw={c.phone2} e164={c.phone2_e164} type={c.phone2_type} whatsapp={c.phone_type === 'mobile' ? 'no_mobile' : c.whatsapp_status} small />}
                      {!c.phone && !c.phone2 && <span className="text-xs text-slate-400">No phone</span>}
                    </td>}
                    {cols.has('email') && <td className="max-w-56 truncate text-sm">{c.email || <span className="text-xs text-slate-400">No email</span>}</td>}
                    {cols.has('status') && <td>
                      {c.do_not_contact ? (
                        <span className="text-xs text-red-700">{c.do_not_contact_reason || 'Do not contact'}{c.do_not_contact_at && ` · ${formatDate(c.do_not_contact_at)}`}</span>
                      ) : missing.length ? (
                        <span className="badge !border-amber-200 !bg-amber-50 !text-amber-700" title={`Missing: ${missing.join(', ')}`}>Missing: {missing.join(', ')}</span>
                      ) : (
                        <span className="badge !border-emerald-200 !bg-emerald-50 !text-emerald-700"><CheckCircle2 size={12} /> Ready</span>
                      )}
                    </td>}
                    {cols.has('town') && <td className="text-sm">{[c.town, c.postcode].filter(Boolean).join(', ') || '-'}</td>}
                    {cols.has('tags') && <td className="text-xs">{c.tags.length ? c.tags.join(', ') : '-'}</td>}
                    {cols.has('visit') && <td className="whitespace-nowrap text-sm">{c.last_purchase_on ? formatDate(c.last_purchase_on) : '-'}{c.purchased && <div className="text-xs text-slate-500">{c.purchased}</div>}</td>}
                    {cols.has('birthday') && <td className="text-sm">{c.birthday_month ? MONTH_NAMES[c.birthday_month - 1] : '-'}</td>}
                    {cols.has('country') && <td className="text-sm">{c.country}</td>}
                    {cols.has('consent') && <td className="whitespace-nowrap text-xs">{c.consent_confirmed ? `Yes${c.consent_confirmed_at ? `, ${formatDate(c.consent_confirmed_at)}` : ''}` : <span className="text-amber-700">No</span>}</td>}
                    {cols.has('added') && <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(c.created_at)}<br />{c.source === 'csv' ? 'CSV' : 'Form'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} basePath={pathname} params={{ tab: filters.tab === 'all' ? undefined : filters.tab, q: filters.q, phone: filters.phone, country: filters.country }} />

      {isAdmin && counts.total > 0 && (
        <div className="flex justify-end">
          <button className="btn btn-ghost btn-sm !text-red-700" onClick={() => setDeletingAll(true)}><Trash2 size={14} /> Delete all of {business.business_name}&apos;s customers</button>
        </div>
      )}
      </>)}

      {editing && (
        <CustomerForm
          key={editing === 'new' ? 'new' : editing.id}
          businessId={business.id}
          customer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <CustomerImportModal open={importing} onClose={() => setImporting(false)} businessId={business.id} businessName={business.business_name} />

      <Modal open={confirm === 'dnc'} onClose={closeConfirm} locked={bulk.pending} title={`Stop contacting ${selected.length} customer${selected.length === 1 ? '' : 's'}?`}>
        <p className="text-sm text-slate-600">They move to &ldquo;Do not contact&rdquo; and won&apos;t be included in marketing. You can undo this later.</p>
        <label className="label mt-3">Reason</label>
        <input className="input" placeholder="For example: asked the client to stop" value={reason} onChange={e => setReason(e.target.value)} />
        <ErrorNote error={bulk.error} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" disabled={bulk.pending} onClick={closeConfirm}>Cancel</button>
          <button className="btn btn-danger" disabled={bulk.pending} onClick={() => bulk.run(() => setCustomerDoNotContact(business.id, selected, true, reason), () => { closeConfirm(); setSelected([]) }, { success: n => `${n} moved to Do not contact.` })}>
            {bulk.pending ? <Spinner /> : <Ban size={16} />} Do not contact
          </button>
        </div>
      </Modal>
      <Modal open={deletingAll} onClose={() => { setDeletingAll(false); setConfirmName(''); bulk.setError(null) }} locked={bulk.pending} title="Delete all customers?">
        <p className="text-sm text-slate-600">
          All {counts.total.toLocaleString('en-GB')} customers of {business.business_name} are removed for good, for example when the client leaves or asks us to.
          Campaign reports keep their numbers. This is logged.
        </p>
        <label className="label mt-3">Type <b>{business.business_name}</b> to confirm</label>
        <input className="input" value={confirmName} onChange={e => setConfirmName(e.target.value)} />
        <ErrorNote error={bulk.error} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" disabled={bulk.pending} onClick={() => { setDeletingAll(false); setConfirmName('') }}>Cancel</button>
          <button className="btn btn-danger" disabled={bulk.pending || confirmName.trim().toLowerCase() !== business.business_name.trim().toLowerCase()}
            onClick={() => bulk.run(() => deleteAudience(business.id, confirmName), () => { setDeletingAll(false); setConfirmName('') }, { success: n => `${n} customers deleted.` })}>
            {bulk.pending ? <Spinner /> : <Trash2 size={16} />} Delete all
          </button>
        </div>
      </Modal>
      <Modal open={confirm === 'delete'} onClose={closeConfirm} locked={bulk.pending} title={`Delete ${selected.length} customer${selected.length === 1 ? '' : 's'}?`}>
        <p className="text-sm text-slate-600">They are removed for good. To stop marketing to someone but keep their record, use &ldquo;Do not contact&rdquo; instead.</p>
        <ErrorNote error={bulk.error} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" disabled={bulk.pending} onClick={closeConfirm}>Cancel</button>
          <button className="btn btn-danger" disabled={bulk.pending} onClick={() => bulk.run(() => deleteCustomerLeads(business.id, selected), () => { closeConfirm(); setSelected([]) }, { success: n => `${n} deleted.` })}>
            {bulk.pending ? <Spinner /> : <Trash2 size={16} />} Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Same as Lead Management: a mobile opens WhatsApp, a landline opens the dialler
function PhoneCell({ raw, e164, type, whatsapp, small }: { raw: string | null; e164: string | null; type: PhoneType | null; whatsapp: CustomerLead['whatsapp_status']; small?: boolean }) {
  if (!raw) return null
  const digits = (e164 || raw).replace(/\D/g, '')
  const mobile = type === 'mobile' || type === 'mobile_or_landline'
  if (type === 'invalid' || !e164) {
    return <div className={`${small ? 'mt-0.5 text-xs' : 'text-sm'} whitespace-nowrap text-red-600`}>{raw} <span className="text-[11px] font-semibold">Not a valid number</span></div>
  }
  const note = !mobile ? (type === 'landline' ? 'Landline' : 'Other')
    : whatsapp === 'confirmed' ? 'On WhatsApp'
      : whatsapp === 'not_on_whatsapp' ? 'Not on WhatsApp'
        : 'WhatsApp'
  return (
    <div className={`${small ? 'mt-0.5 text-xs' : 'text-sm'} flex flex-wrap items-center gap-x-2`}>
      <a
        href={mobile && whatsapp !== 'not_on_whatsapp' ? `https://wa.me/${digits}` : `tel:${e164}`}
        target={mobile ? '_blank' : undefined}
        rel="noreferrer"
        onClick={e => e.stopPropagation()}
        title={mobile ? 'Open in WhatsApp' : 'Call'}
        className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-slate-800 transition-colors hover:text-emerald-700"
      >
        {mobile ? <MessageCircle size={13} className={whatsapp === 'not_on_whatsapp' ? 'text-slate-400' : 'text-emerald-600'} /> : <Phone size={13} className="text-slate-400" />}
        {e164}
        <span className="text-xs text-slate-400">↗</span>
      </a>
      <span className={`text-[11px] font-semibold ${mobile && whatsapp !== 'not_on_whatsapp' ? 'text-emerald-700' : whatsapp === 'not_on_whatsapp' ? 'text-red-600' : 'text-slate-500'}`}>{note}</span>
    </div>
  )
}

// ---------- Add / edit one customer ----------

function CustomerForm({ businessId, customer, onClose }: { businessId: string; customer: CustomerLead | null; onClose: () => void }) {
  const [v, setV] = useState<Required<Omit<CustomerInput, 'tags' | 'birthday_month'>> & { tags: string; birthday_month: string }>({
    first_name: customer?.first_name ?? '',
    last_name: customer?.last_name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    phone2: customer?.phone2 ?? '',
    town: customer?.town ?? '',
    postcode: customer?.postcode ?? '',
    last_purchase_on: customer?.last_purchase_on ?? '',
    purchased: customer?.purchased ?? '',
    birthday_month: customer?.birthday_month ? String(customer.birthday_month) : '',
    tags: customer?.tags.join(', ') ?? '',
    notes: customer?.notes ?? '',
  })
  const [country, setCountry] = useState<Country>(customer?.country ?? 'UK')
  const [consent, setConsent] = useState(customer?.consent_confirmed ?? false)
  const { run, pending, error } = useAction()
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value })
  const p1 = useMemo(() => checkPhone(v.phone, country), [v.phone, country])
  const p2 = useMemo(() => checkPhone(v.phone2, country), [v.phone2, country])
  const empty = !v.first_name?.trim() && !v.email?.trim() && !v.phone?.trim() && !v.phone2?.trim()

  const save = () => run(
    () => saveCustomerLead(businessId, customer?.id ?? null, v, { country, consent }),
    onClose,
    { success: customer ? 'Customer saved.' : 'Customer added.' },
  )

  return (
    <Modal open onClose={onClose} locked={pending} wide title={customer ? 'Edit customer' : 'Add customer'}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name" required><input className="input" autoFocus value={v.first_name ?? ''} onChange={set('first_name')} /></Field>
        <Field label="Last name"><input className="input" value={v.last_name ?? ''} onChange={set('last_name')} /></Field>
        <Field label="Email" span hint={<span className="text-xs text-slate-500">Provide at least one contact method (email or phone) <span className="text-red-500 font-bold ml-0.5">*</span></span>}><input className="input" type="email" value={v.email ?? ''} onChange={set('email')} /></Field>
        <Field label="Phone / mobile" hint={<PhoneHint check={p1} />}><input className="input" inputMode="tel" placeholder={country === 'UK' ? '07911 123456' : '98765 43210'} value={v.phone ?? ''} onChange={set('phone')} /></Field>
        <Field label="Second phone" hint={<PhoneHint check={p2} />}><input className="input" inputMode="tel" placeholder="Landline or other" value={v.phone2 ?? ''} onChange={set('phone2')} /></Field>
        <Field label="Country" required>
          <select className="input" value={country} onChange={e => setCountry(e.target.value as Country)}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Town / city"><input className="input" value={v.town ?? ''} onChange={set('town')} /></Field>
        <Field label={country === 'India' ? 'PIN code' : 'Postcode'}><input className="input" value={v.postcode ?? ''} onChange={set('postcode')} /></Field>
        <Field label="Birthday month">
          <select className="input" value={v.birthday_month} onChange={set('birthday_month')}>
            <option value="">Not known</option>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </Field>
        <Field label="Last visit / purchase"><input className="input" type="date" value={v.last_purchase_on ?? ''} onChange={set('last_purchase_on')} /></Field>
        <Field label="What they bought"><input className="input" value={v.purchased ?? ''} onChange={set('purchased')} /></Field>
        <Field label="Tags" span hint={<span className="text-xs text-slate-500">Separate with commas, e.g. VIP, regular</span>}><input className="input" value={v.tags} onChange={set('tags')} /></Field>
        <Field label="Notes" span><textarea className="input min-h-20" value={v.notes ?? ''} onChange={set('notes')} /></Field>
      </div>
      <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>
          The client confirmed this customer agreed to marketing <span className="text-red-500 font-bold ml-0.5">*</span>. Without this, the customer stays in &ldquo;Missing data&rdquo;.
        </span>
      </label>
      <ErrorNote error={error} />
      <div className="mt-4 flex items-center justify-end gap-2">
        {empty && <span className="mr-auto text-xs text-slate-500">Add a name, an email or a phone number.</span>}
        <button className="btn btn-secondary" disabled={pending} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={pending || empty} onClick={save}>{pending && <Spinner />} {customer ? 'Save' : 'Add customer'}</button>
      </div>
      {customer && (
        <p className="mt-3 text-xs text-slate-400">
          Added {formatDate(customer.created_at)} by {customer.source === 'csv' ? 'CSV import' : 'form'}
          {customer.consent_confirmed_at && ` · consent confirmed ${formatDate(customer.consent_confirmed_at)}`}
        </p>
      )}
    </Modal>
  )
}

function Field({ label, hint, span, required, children }: { label: string; hint?: React.ReactNode; span?: boolean; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="label">
        {label}
        {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1">{hint}</div>}
    </div>
  )
}

function PhoneHint({ check }: { check: ReturnType<typeof checkPhone> }) {
  if (!check) return null
  if (check.type === 'invalid') return <span className="text-xs font-medium text-red-600">Not a valid UK or India number</span>
  return (
    <span className={`text-xs font-medium ${check.type === 'mobile' ? 'text-sky-700' : 'text-slate-500'}`}>
      {check.country} {PHONE_TYPE_LABEL[check.type].toLowerCase()}{check.type === 'mobile' ? ' · opens in WhatsApp' : check.type === 'landline' ? ' · calls only' : ''}
    </span>
  )
}

