'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/auth'
import { setCadence, removeOptOut } from '@/app/dashboard/actions'
import { Modal, useAction, ErrorNote, Spinner, SaveLabel } from '@/components/ui'

export type OptOut = {
  id: string; identifier: string; channel: string; reason: string | null
  source: string | null; createdAt: string; business: string | null
}

const STEPS = [
  { key: 'Follow up 1', label: 'First contact to Follow-up 1' },
  { key: 'Follow up 2', label: 'Follow-up 1 to Follow-up 2' },
  { key: 'Follow up 3', label: 'Follow-up 2 to Final check' },
]

export function SettingsView({ me, isAdmin, cadence, optOuts = [] }: {
  me: Profile; isAdmin: boolean
  cadence: { step_name: string; days_delay: number }[]; optOuts?: OptOut[]
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <MyAccount me={me} />
      {isAdmin && <Timing cadence={cadence} />}
      {isAdmin && <AudienceTiming cadence={cadence} />}
      {isAdmin && <DoNotContact list={optOuts} />}
    </div>
  )
}

// ---------- My account ----------
function MyAccount({ me }: { me: Profile }) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">My account</h2>
        <p className="text-sm text-muted">User profile and permissions managed via Selfera Admin.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <div className="space-y-1">
          <span className="text-xs uppercase font-medium tracking-wider text-muted">Full Name</span>
          <p className="text-sm font-medium">{me.full_name || '—'}</p>
        </div>
        <div className="space-y-1">
          <span className="text-xs uppercase font-medium tracking-wider text-muted">Email</span>
          <p className="text-sm font-medium">{me.email || '—'}</p>
        </div>
        <div className="space-y-1">
          <span className="text-xs uppercase font-medium tracking-wider text-muted">Role</span>
          <p className="text-sm font-medium capitalize">{me.display_role || me.role || '—'}</p>
        </div>
      </div>
    </section>
  )
}

// ---------- Follow-up timing ----------
function Timing({ cadence }: { cadence: { step_name: string; days_delay: number }[] }) {
  const initial = Object.fromEntries(STEPS.map(s => [s.key, cadence.find(c => c.step_name === s.key)?.days_delay ?? 0]))
  const [days, setDays] = useState<Record<string, number>>(initial)
  const { run, pending, isSaved, error } = useAction()
  const changed = STEPS.filter(s => days[s.key] !== initial[s.key])

  const save = () => {
    run(async () => {
      for (const s of changed) {
        const res = await setCadence(s.key, days[s.key])
        if (!res.ok) return res
      }
      return { ok: true }
    }, undefined, { success: 'Follow-up timing saved.', key: 'timing' })
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold">Follow-up timing</h2>
        <p className="text-sm text-muted">Working days to wait before the next message. Applies to messages sent from now on.</p>
      </div>
      {STEPS.map(s => (
        <div key={s.key} className="flex items-center justify-between gap-3 text-sm">
          <span>{s.label}</span>
          <span className="flex items-center gap-2">
            <input
              className="input !w-20 text-right" type="number" min={1} max={60} value={days[s.key]}
              onChange={e => setDays({ ...days, [s.key]: Number(e.target.value) })}
              aria-label={s.label}
            />
            <span className="w-8 text-muted">days</span>
          </span>
        </div>
      ))}
      <div className="flex items-center justify-end gap-3">
        <button className={`btn btn-primary btn-sm ${isSaved('timing') ? '!bg-emerald-600 !opacity-100' : ''}`} onClick={save} disabled={pending || changed.length === 0}>
          <SaveLabel pending={pending} saved={isSaved('timing')} label="Save" />
        </button>
      </div>
      <ErrorNote error={error} />
    </section>
  )
}

// ---------- Client Audience campaign timing ----------
function AudienceTiming({ cadence }: { cadence: { step_name: string; days_delay: number }[] }) {
  const initial = cadence.find(c => c.step_name === 'Audience gap')?.days_delay ?? 14
  const [days, setDays] = useState(initial)
  const { run, pending, isSaved, error } = useAction()
  return (
    <section className="card space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Client Audience campaign timing</h2>
        </div>
        <p className="text-sm text-muted">The shortest gap between two campaign messages to the same person in a client&apos;s audience, so nobody is messaged too often.</p>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>Gap between campaign messages</span>
        <span className="flex items-center gap-2">
          <input className="input !w-20 text-right" type="number" min={1} max={180} value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Gap between campaign messages" />
          <span className="w-8 text-muted">days</span>
        </span>
      </div>
      <div className="flex items-center justify-end gap-3">
        <button className={`btn btn-primary btn-sm ${isSaved('audience') ? '!bg-emerald-600 !opacity-100' : ''}`} onClick={() => run(() => setCadence('Audience gap', days), undefined, { success: 'Campaign gap saved.', key: 'audience' })} disabled={pending || days === initial}>
          <SaveLabel pending={pending} saved={isSaved('audience')} label="Save" />
        </button>
      </div>
      <ErrorNote error={error} />
    </section>
  )
}

const SOURCE_LABEL: Record<string, string> = {
  unsubscribe: 'Opted out',
  bounce: 'Email bounced',
  complaint: 'Marked as spam',
  inbound: 'Asked by message',
}

function DoNotContact({ list }: { list: OptOut[] }) {
  const [query, setQuery] = useState('')
  const [undoing, setUndoing] = useState<OptOut | null>(null)
  const { run, pending, error } = useAction()
  const q = query.trim().toLowerCase()
  const shown = q
    ? list.filter(o => o.identifier.toLowerCase().includes(q) || o.business?.toLowerCase().includes(q))
    : list

  return (
    <section id="do-not-contact" className="card space-y-3 scroll-mt-20">
      <div>
        <h2 className="font-semibold">Do-not-contact</h2>
        <p className="text-sm text-muted">
          Nothing is sent to these addresses: leads who opted out, whose email bounced, or who marked us as spam.
        </p>
      </div>
      {list.length > 5 && (
        <input className="input" placeholder="Search by email or business" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search do-not-contact list" />
      )}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-muted">
          {list.length ? 'No matches.' : 'No one is on the list yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {shown.map(o => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{o.business || o.identifier}</p>
                <p className="truncate text-xs text-muted">
                  {o.business && <>{o.identifier} · </>}
                  {SOURCE_LABEL[o.source || ''] || o.source || 'Added'} · {o.channel} ·{' '}
                  {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm shrink-0" onClick={() => setUndoing(o)}>Undo</button>
            </li>
          ))}
        </ul>
      )}

      <Modal title="Remove from do-not-contact?" open={!!undoing} onClose={() => setUndoing(null)} locked={pending}>
        {undoing && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{undoing.business || undoing.identifier}</span> can be emailed again.
              Only do this if they asked to hear from us. The change is logged.
            </p>
            {undoing.source === 'bounce' && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This address bounced. Check it is correct first, or it will bounce again.</p>
            )}
            <ErrorNote error={error} />
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setUndoing(null)} disabled={pending}>Cancel</button>
              <button
                className="btn btn-primary btn-sm" disabled={pending}
                onClick={() => run(() => removeOptOut(undoing.id), () => setUndoing(null), { success: `${undoing.business || undoing.identifier} can be emailed again.` })}
              >
                {pending && <Spinner size={14} />} Remove
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
