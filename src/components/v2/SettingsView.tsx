'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { Profile } from '@/lib/auth'
import { setMyName, setCadence, updateMember, inviteMember } from '@/app/dashboard/actions'
import { Modal, useAction, ErrorNote, Spinner } from '@/components/ui'

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

const STEPS = [
  { key: 'Follow up 1', label: 'First contact to Follow-up 1' },
  { key: 'Follow up 2', label: 'Follow-up 1 to Follow-up 2' },
  { key: 'Follow up 3', label: 'Follow-up 2 to Final check' },
]

export function SettingsView({ me, isAdmin, team, teamNote, cadence }: {
  me: Profile; isAdmin: boolean; team: Member[]; teamNote: string | null
  cadence: { step_name: string; days_delay: number }[]
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <MyAccount me={me} />
      {isAdmin && <Team team={team} note={teamNote} meId={me.id} />}
      {isAdmin && <Timing cadence={cadence} />}
    </div>
  )
}

// ---------- My account ----------
function MyAccount({ me }: { me: Profile }) {
  const [name, setName] = useState(me.full_name || '')
  const [saved, setSaved] = useState(false)
  const { run, pending, error } = useAction()
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold">My account</h2>
        <p className="text-sm text-muted">Your first name is used in message drafts.</p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={e => { e.preventDefault(); setSaved(false); run(() => setMyName(name), () => setSaved(true)) }}
      >
        <input className="input !w-auto min-w-64 flex-1" value={name} onChange={e => { setName(e.target.value); setSaved(false) }} aria-label="Your name" />
        <button className="btn btn-primary btn-sm" disabled={pending || name.trim() === (me.full_name || '')}>{pending && <Spinner size={14} />} Save</button>
      </form>
      {saved && <p className="text-sm text-emerald-700">Saved.</p>}
      <ErrorNote error={error} />
    </section>
  )
}

// ---------- Team ----------
function Team({ team, note, meId }: { team: Member[]; note: string | null; meId: string }) {
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const sorted = [...team].sort((a, z) => Number(z.active) - Number(a.active) || a.fullName.localeCompare(z.fullName))
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Team</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setInviting(true)} disabled={!!note}><UserPlus size={16} /> Add person</button>
      </div>
      {note && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>}
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {sorted.map(m => (
              <tr key={m.id} className="cursor-pointer" onClick={() => setEditing(m)}>
                <td className={m.active ? '' : 'text-slate-400'}>
                  <div className="font-medium">{m.fullName || 'No name'}{m.id === meId && <span className="text-muted font-normal"> (you)</span>}</div>
                  <div className="text-xs text-muted">{m.email}</div>
                </td>
                <td className="text-sm">{roleLabel(m.role)}</td>
                <td className="text-right text-xs">
                  {!m.active ? <span className="text-slate-400">Switched off</span> : m.invited ? <span className="text-amber-700">Invite sent</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {inviting && <InviteModal onClose={() => setInviting(false)} />}
      {editing && <EditMember member={editing} isMe={editing.id === meId} onClose={() => setEditing(null)} />}
    </section>
  )
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState({ email: '', fullName: '', role: 'sales' })
  const { run, pending, error } = useAction()
  return (
    <Modal title="Add person" open onClose={onClose}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(() => inviteMember(v), onClose) }}>
        <input className="input" type="email" placeholder="Email" value={v.email} onChange={e => setV({ ...v, email: e.target.value })} autoFocus />
        <input className="input" placeholder="Full name" value={v.fullName} onChange={e => setV({ ...v, fullName: e.target.value })} />
        <select className="input" value={v.role} onChange={e => setV({ ...v, role: e.target.value })} aria-label="Role">
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <p className="text-xs text-muted">They get an email with a link to set their password.</p>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={pending}>{pending && <Spinner size={14} />} Send invite</button>
        </div>
      </form>
    </Modal>
  )
}

function EditMember({ member, isMe, onClose }: { member: Member; isMe: boolean; onClose: () => void }) {
  const [v, setV] = useState({ fullName: member.fullName, role: member.role, capacity: member.capacity ?? 150, active: member.active })
  const { run, pending, error } = useAction()
  return (
    <Modal title={member.fullName || member.email} open onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={e => { e.preventDefault(); run(() => updateMember({ id: member.id, ...v, capacity: v.role === 'sales' ? v.capacity : null }), onClose) }}
      >
        {member.email && <p className="text-sm text-muted">{member.email}</p>}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Name</span>
          <input className="input" value={v.fullName} onChange={e => setV({ ...v, fullName: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Role</span>
          <select className="input" value={v.role} disabled={isMe} onChange={e => setV({ ...v, role: e.target.value })}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        {v.role === 'sales' && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Most active leads at once</span>
            <input className="input" type="number" min={1} max={1000} value={v.capacity} onChange={e => setV({ ...v, capacity: Number(e.target.value) })} />
          </label>
        )}
        {!isMe && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.active} onChange={e => setV({ ...v, active: e.target.checked })} />
            Can log in
          </label>
        )}
        {!isMe && !v.active && member.active && (
          <p className="text-xs text-muted">They will be logged out and blocked. Their history is kept. Reassign their leads in Lead Management.</p>
        )}
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={pending}>{pending && <Spinner size={14} />} Save</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Follow-up timing ----------
function Timing({ cadence }: { cadence: { step_name: string; days_delay: number }[] }) {
  const initial = Object.fromEntries(STEPS.map(s => [s.key, cadence.find(c => c.step_name === s.key)?.days_delay ?? 0]))
  const [days, setDays] = useState<Record<string, number>>(initial)
  const [saved, setSaved] = useState(false)
  const { run, pending, error } = useAction()
  const changed = STEPS.filter(s => days[s.key] !== initial[s.key])

  const save = () => {
    setSaved(false)
    run(async () => {
      for (const s of changed) {
        const res = await setCadence(s.key, days[s.key])
        if (!res.ok) return res
      }
      return { ok: true }
    }, () => setSaved(true))
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
              onChange={e => { setDays({ ...days, [s.key]: Number(e.target.value) }); setSaved(false) }}
              aria-label={s.label}
            />
            <span className="w-8 text-muted">days</span>
          </span>
        </div>
      ))}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-700">Saved.</span>}
        <button className="btn btn-primary btn-sm" onClick={save} disabled={pending || changed.length === 0}>{pending && <Spinner size={14} />} Save</button>
      </div>
      <ErrorNote error={error} />
    </section>
  )
}
