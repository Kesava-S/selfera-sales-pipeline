'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/auth'
import { setMyName, setCadence, setMemberCapacity, removeOptOut } from '@/app/dashboard/actions'
import { Modal, useAction, ErrorNote, Spinner, SaveLabel } from '@/components/ui'

export type OptOut = {
  id: string; identifier: string; channel: string; reason: string | null
  source: string | null; createdAt: string; business: string | null
}

export type Member = {
  id: string; fullName: string; role: string; capacity: number | null
  active: boolean; email: string; invited: boolean
}

const ROLES = [
  { value: 'sales', label: 'Sales' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'admin', label: 'Admin' },
]
const roleLabel = (r: string) => ROLES.find(x => x.value === r)?.label ?? r

// People, their role and whether they can log in are managed in the Admin Panel
const ADMIN_ACCESS_URL = process.env.NEXT_PUBLIC_ADMIN_URL ? `${process.env.NEXT_PUBLIC_ADMIN_URL.replace(/\/+$/, '')}/access` : null

function ManagedInAdmin() {
  return (
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
      To add someone, change their role or remove their access, use the{' '}
      {ADMIN_ACCESS_URL
        ? <a className="font-medium text-primary underline" href={ADMIN_ACCESS_URL} target="_blank" rel="noreferrer">Access page in the Admin Panel</a>
        : <b>Access page in the Admin Panel</b>}.
    </p>
  )
}

const STEPS = [
  { key: 'Follow up 1', label: 'First contact to Follow-up 1' },
  { key: 'Follow up 2', label: 'Follow-up 1 to Follow-up 2' },
  { key: 'Follow up 3', label: 'Follow-up 2 to Final check' },
]

export function SettingsView({ me, isAdmin, team, teamNote, cadence, optOuts = [] }: {
  me: Profile; isAdmin: boolean; team: Member[]; teamNote: string | null
  cadence: { step_name: string; days_delay: number }[]; optOuts?: OptOut[]
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <MyAccount me={me} />
      {isAdmin && <Team team={team} note={teamNote} meId={me.id} />}
      {isAdmin && <Timing cadence={cadence} />}
      {isAdmin && <DoNotContact list={optOuts} />}
    </div>
  )
}

// ---------- My account ----------
function MyAccount({ me }: { me: Profile }) {
  const [name, setName] = useState(me.full_name || '')
  const { run, pending, isSaved, error } = useAction()
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold">My account</h2>
        <p className="text-sm text-muted">Your first name is used in message drafts.</p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={e => { e.preventDefault(); run(() => setMyName(name), undefined, { success: 'Your name was saved.', key: 'name' }) }}
      >
        <input className="input !w-auto min-w-64 flex-1" value={name} onChange={e => setName(e.target.value)} aria-label="Your name" />
        <button className={`btn btn-primary btn-sm ${isSaved('name') ? '!bg-emerald-600 !opacity-100' : ''}`} disabled={pending || name.trim() === (me.full_name || '')}>
          <SaveLabel pending={pending} saved={isSaved('name')} label="Save" />
        </button>
      </form>
      <ErrorNote error={error} />
    </section>
  )
}

// ---------- Team ----------
function Team({ team, note, meId }: { team: Member[]; note: string | null; meId: string }) {
  const [editing, setEditing] = useState<Member | null>(null)
  const [selectedRole, setSelectedRole] = useState<'admin' | 'sales' | 'consultant' | null>(null)
  
  const sorted = [...team].sort((a, z) => Number(z.active) - Number(a.active) || a.fullName.localeCompare(z.fullName))
  const filtered = selectedRole ? sorted.filter(m => m.role === selectedRole) : []

  if (selectedRole) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedRole(null)}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <h2 className="font-semibold capitalize">{selectedRole} Team</h2>
          </div>
        </div>

        <ManagedInAdmin />
        {note && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted py-4 col-span-full">No users in this category.</p>
          ) : (
            filtered.map(m => (
              <div key={m.id} onClick={() => setEditing(m)} className="card cursor-pointer hover:border-primary transition-colors flex flex-col gap-1 p-4 shadow-sm border border-slate-200 rounded-xl">
                <div className="font-semibold text-slate-900 flex items-center justify-between">
                  {m.fullName || 'No name'}
                  {m.id === meId && <span className="text-xs font-normal text-muted bg-slate-100 px-2 py-0.5 rounded-full">You</span>}
                </div>
                <div className="text-sm text-slate-500 truncate" title={m.email}>{m.email}</div>
                <div className="text-xs font-medium mt-2">
                  {!m.active ? <span className="text-red-500 bg-red-50 px-2 py-1 rounded-md">No access</span> : m.invited ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Password not set</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Active</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {editing && <EditMember member={editing} onClose={() => setEditing(null)} />}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Team Management</h2>
      </div>
      <ManagedInAdmin />
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ROLES.map(role => {
          const count = team.filter(m => m.role === role.value).length;
          return (
            <div 
              key={role.value} 
              onClick={() => setSelectedRole(role.value as any)} 
              className="card cursor-pointer hover:border-primary transition-colors p-5 shadow-sm border border-slate-200 rounded-xl flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-lg text-slate-900">{role.label}</div>
                <div className="text-sm text-slate-500 mt-1">{count} {count === 1 ? 'member' : 'members'}</div>
              </div>
              <div className="text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function EditMember({ member, onClose }: { member: Member; onClose: () => void }) {
  const [capacity, setCapacity] = useState(member.capacity ?? 150)
  const { run, pending, error } = useAction()
  const isSales = member.role === 'sales'

  return (
    <Modal title={member.fullName || member.email} open onClose={onClose} locked={pending}>
      <form
        className="space-y-3"
        onSubmit={e => { e.preventDefault(); run(() => setMemberCapacity(member.id, capacity), onClose, { success: 'Changes saved.' }) }}
      >
        {member.email && <p className="text-sm text-muted">{member.email}</p>}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Role</dt><dd>{roleLabel(member.role)}</dd>
          <dt className="text-muted">Can log in</dt><dd>{member.active ? 'Yes' : 'No'}</dd>
        </dl>
        {isSales && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Most active leads at once</span>
            <input className="input" type="number" min={1} max={1000} value={capacity} onChange={e => setCapacity(Number(e.target.value))} />
          </label>
        )}
        <ManagedInAdmin />
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={pending}>{isSales ? 'Cancel' : 'Close'}</button>
          {isSales && <button className="btn btn-primary btn-sm" disabled={pending}>{pending && <Spinner size={14} />} Save</button>}
        </div>
      </form>
    </Modal>
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

const SOURCE_LABEL: Record<string, string> = {
  unsubscribe: 'Unsubscribed',
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
          Nothing is sent to these addresses: leads who unsubscribed, whose email bounced, or who marked us as spam.
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
