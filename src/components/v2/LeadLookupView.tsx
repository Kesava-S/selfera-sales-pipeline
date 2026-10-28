'use client'

// Lead Lookup. Pick a lead, search Google Places and
// Companies House, compare what was found with what we have, and apply the
// values you want. Empty fields are ticked by default; existing ones never are.

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Building2, CheckCircle2, ExternalLink, MapPin, Search, Star } from 'lucide-react'
import { applyLookup, lookupBusiness, type LookupResults } from '@/app/dashboard/lookup/actions'
import type { LookupField, Suggestion } from '@/lib/enrich'
import { EmptyState, ErrorNote, SaveLabel, Spinner, useAction } from '@/components/ui'

export type LookupLead = {
  id: string
  business_name: string
  business_type: string | null
  area: string | null
  address: string | null
  postcode: string | null
  phone: string | null
  existing_website: string | null
  maps_link: string | null
  google_rating: number | null
  google_reviews_count: number | null
  company_type: string | null
  contact_name: string | null
}

const FIELDS: { key: LookupField; label: string }[] = [
  { key: 'address', label: 'Address' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'area', label: 'Area / town' },
  { key: 'phone', label: 'Phone' },
  { key: 'existing_website', label: 'Website' },
  { key: 'maps_link', label: 'Google Maps' },
  { key: 'google_rating', label: 'Google rating' },
  { key: 'google_reviews_count', label: 'Reviews' },
  { key: 'business_type', label: 'Category' },
  { key: 'company_type', label: 'Company type' },
  { key: 'contact_name', label: 'Owner / director' },
]

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || v === 'Unknown'
const missingCount = (l: LookupLead) => FIELDS.filter(f => isEmpty(l[f.key])).length

export function LeadLookupView({ leads: initialLeads, config }: { leads: LookupLead[]; config: { places: boolean; companiesHouse: boolean } }) {
  const [leads, setLeads] = useState(initialLeads)
  const [filter, setFilter] = useState('')
  const [leadId, setLeadId] = useState<string | null>(null)
  const lead = leads.find(l => l.id === leadId) || null

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LookupResults | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [companyNo, setCompanyNo] = useState<string | null>(null)
  const [picked, setPicked] = useState<Partial<Record<LookupField, boolean>>>({})
  const apply = useAction()

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return leads.filter(l => !q || `${l.business_name} ${l.area || ''} ${l.postcode || ''}`.toLowerCase().includes(q)).slice(0, 100)
  }, [leads, filter])

  const place = results?.places.find(p => p.id === placeId)
  const company = results?.companies.find(c => c.number === companyNo)
  const found: Suggestion = { ...(place?.suggestion || {}), ...(company?.suggestion || {}) }

  // Tick fields we don't have yet; never tick over existing data by default
  const defaultsFor = (l: LookupLead | null, s: Suggestion) =>
    Object.fromEntries(FIELDS.map(f => [f.key, s[f.key] !== undefined && (!l || isEmpty(l[f.key])) && String(s[f.key]) !== String(l?.[f.key] ?? '')]))

  const chooseLead = (l: LookupLead) => {
    setLeadId(l.id)
    // The area/town usually matches better on Google than a bare postcode
    setQuery([l.business_name, l.area || l.postcode].filter(Boolean).join(' '))
    setResults(null)
    setPlaceId(null)
    setCompanyNo(null)
    setPicked({})
  }

  const runSearch = () => {
    setSearchError(null)
    startSearch(async () => {
      const res = await lookupBusiness(query).catch(() => ({ ok: false as const, error: 'Could not reach the server.' }))
      if (!res.ok) return setSearchError(res.error)
      const data = res.data!
      setResults(data)
      // Preselect the top match from each source
      const p = data.places[0]?.id ?? null
      const c = data.companies[0]?.number ?? null
      setPlaceId(p)
      setCompanyNo(c)
      setPicked(defaultsFor(lead, { ...(data.places[0]?.suggestion || {}), ...(data.companies[0]?.suggestion || {}) }))
    })
  }

  const pickPlace = (id: string | null) => {
    setPlaceId(id)
    setPicked(defaultsFor(lead, { ...(results?.places.find(p => p.id === id)?.suggestion || {}), ...(company?.suggestion || {}) }))
  }
  const pickCompany = (no: string | null) => {
    setCompanyNo(no)
    setPicked(defaultsFor(lead, { ...(place?.suggestion || {}), ...(results?.companies.find(c => c.number === no)?.suggestion || {}) }))
  }

  const chosen = FIELDS.filter(f => picked[f.key] && found[f.key] !== undefined)
  const save = () => {
    if (!lead) return
    const values = Object.fromEntries(chosen.map(f => [f.key, found[f.key]])) as Suggestion
    apply.run(
      () => applyLookup(lead.id, values),
      () => {
        setLeads(prev => prev.map(l => (l.id === lead.id ? { ...l, ...values } as LookupLead : l)))
        setPicked({})
      },
      { success: `Updated ${chosen.length} field${chosen.length === 1 ? '' : 's'} on ${lead.business_name}.`, key: 'apply' }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="!mb-0 text-2xl font-bold tracking-tight text-slate-900">Lead Lookup</h1>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          Find a business on Google and Companies House, then fill in a lead&apos;s missing details.
        </p>
      </div>

      {(!config.places || !config.companiesHouse) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>Setup needed.</b> Add to <code>.env.local</code>, then restart the dev server:
            <ul className="mt-1 list-disc pl-5 text-xs">
              {!config.places && <li><code>GOOGLE_PLACES_API_KEY</code>: a Google Cloud key with &ldquo;Places API (New)&rdquo; enabled (billed per search).</li>}
              {!config.companiesHouse && <li><code>COMPANIES_HOUSE_API_KEY</code>: free from developer.company-information.service.gov.uk.</li>}
            </ul>
            <span className="text-xs">Search still works with whichever source is set up.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 1. Choose a lead */}
        <section className="card flex max-h-[720px] flex-col !p-0">
          <div className="space-y-2 border-b border-slate-100 p-4">
            <h2 className="!text-base">1. Choose a lead</h2>
            <input className="input" placeholder="Filter by name, area or postcode" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter leads" />
          </div>
          <ul className="flex-1 divide-y divide-slate-50 overflow-y-auto">
            {shown.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No leads match.</li>}
            {shown.map(l => {
              const missing = missingCount(l)
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => chooseLead(l)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${leadId === l.id ? 'bg-primary-bg' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{l.business_name}</span>
                      <span className="block truncate text-xs text-slate-500">{[l.area, l.postcode].filter(Boolean).join(', ') || 'No location'}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${missing ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {missing ? `${missing} missing` : 'Complete'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="space-y-6 lg:col-span-2">
          {/* 2. Search */}
          <section className="card space-y-3">
            <h2 className="!text-base">2. Search{lead ? ` for ${lead.business_name}` : ''}</h2>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); runSearch() }}>
              <input className="input flex-1" placeholder="Business name and town or postcode, e.g. The Crown Hotel Munnar" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search for a business" />
              <button className="btn btn-primary" disabled={searching || query.trim().length < 2}>
                {searching ? <Spinner /> : <Search size={16} />} Search
              </button>
            </form>
            <ErrorNote error={searchError} />
            {!lead && <p className="text-xs text-slate-500">Tip: choose a lead first to compare and save what you find. You can also search without one.</p>}
          </section>

          {searching && !results && (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map(i => <div key={i} className="skeleton h-48 w-full !rounded-[14px]" />)}
            </div>
          )}

          {results && (
            <div className={`grid gap-4 md:grid-cols-2 transition-opacity ${searching ? 'opacity-60' : ''}`}>
              {/* Google Places */}
              <section className="card space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold"><MapPin size={15} className="text-rose-500" /> Google Places</h3>
                <ErrorNote error={results.errors.places} />
                {!results.errors.places && results.places.length === 0 && <p className="text-xs text-slate-500">No match on Google.</p>}
                {results.places.map(p => (
                  <label key={p.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors ${placeId === p.id ? 'border-primary bg-primary-bg' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="place" className="mt-1" checked={placeId === p.id} onChange={() => pickPlace(p.id)} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.address}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                        {p.category && <span>{p.category}</span>}
                        {p.suggestion.google_rating !== undefined && (
                          <span className="flex items-center gap-0.5"><Star size={11} className="fill-amber-400 text-amber-400" />{p.suggestion.google_rating} ({p.suggestion.google_reviews_count ?? 0})</span>
                        )}
                        {p.status && p.status !== 'OPERATIONAL' && <span className="font-semibold text-rose-600">{p.status.replace(/_/g, ' ').toLowerCase()}</span>}
                      </span>
                    </span>
                  </label>
                ))}
                {results.places.length > 0 && (
                  <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => pickPlace(null)}>None of these</button>
                )}
              </section>

              {/* Companies House */}
              <section className="card space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold"><Building2 size={15} className="text-sky-600" /> Companies House</h3>
                <ErrorNote error={results.errors.companies} />
                {!results.errors.companies && results.companies.length === 0 && <p className="text-xs text-slate-500">Not registered, or a different name. Sole traders aren&apos;t listed here.</p>}
                {results.companies.map(c => (
                  <label key={c.number} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors ${companyNo === c.number ? 'border-primary bg-primary-bg' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="company" className="mt-1" checked={companyNo === c.number} onChange={() => pickCompany(c.number)} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{c.name}</span>
                      <span className="block text-xs text-slate-500">No. {c.number} · {c.address}</span>
                      <span className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-600">
                        <span className={c.status === 'active' ? 'text-emerald-700' : 'font-semibold text-rose-600'}>{c.status || 'unknown status'}</span>
                        {c.type && <span>{c.type}</span>}
                        {c.directors.length > 0 && <span>Directors: {c.directors.slice(0, 2).join(', ')}{c.directors.length > 2 ? '…' : ''}</span>}
                      </span>
                    </span>
                  </label>
                ))}
                {results.companies.length > 0 && (
                  <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => pickCompany(null)}>None of these</button>
                )}
              </section>
            </div>
          )}

          {/* 3. Review and apply */}
          {results && (place || company) && (
            <section className="card space-y-3">
              <h2 className="!text-base">3. Review and apply</h2>
              {!lead ? (
                <EmptyState title="Choose a lead to save these details" text="Pick a lead on the left, then search again or apply straight away." />
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th className="w-10" /><th>Field</th><th>Current</th><th>Found</th></tr>
                      </thead>
                      <tbody>
                        {FIELDS.filter(f => found[f.key] !== undefined).map(f => {
                          const current = lead[f.key]
                          const value = found[f.key]
                          const same = String(current ?? '') === String(value)
                          return (
                            <tr key={f.key} className={same ? 'opacity-60' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`Apply ${f.label}`}
                                  checked={Boolean(picked[f.key])}
                                  disabled={same}
                                  onChange={e => setPicked(p => ({ ...p, [f.key]: e.target.checked }))}
                                />
                              </td>
                              <td className="font-medium text-slate-700">{f.label}</td>
                              <td className="max-w-[220px] truncate text-slate-500">{isEmpty(current) ? <i className="text-slate-400">Empty</i> : String(current)}</td>
                              <td className="max-w-[260px] truncate font-medium text-slate-900">
                                {f.key === 'maps_link' || f.key === 'existing_website' ? (
                                  <a href={String(value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary-hover">
                                    {String(value).replace(/^https?:\/\//, '').slice(0, 40)} <ExternalLink size={11} />
                                  </a>
                                ) : (
                                  String(value)
                                )}
                                {same && <CheckCircle2 size={13} className="ml-1 inline text-emerald-600" aria-label="Already matches" />}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ErrorNote error={apply.error} />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Empty fields are ticked for you. Fields that already have a value are only changed if you tick them.</p>
                    <button
                      type="button"
                      className={`btn btn-primary shrink-0 ${apply.isSaved('apply') ? '!bg-emerald-600 !opacity-100' : ''}`}
                      disabled={apply.pending || chosen.length === 0}
                      onClick={save}
                    >
                      <SaveLabel pending={apply.pending} saved={apply.isSaved('apply')} label={`Apply ${chosen.length} change${chosen.length === 1 ? '' : 's'}`} />
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {!results && !searching && (
            <EmptyState
              icon={<Search size={32} />}
              title="Search to see what Google and Companies House know"
              text="Results from both appear side by side. Pick the right match and review each value before saving."
            />
          )}
        </div>
      </div>
    </div>
  )
}
