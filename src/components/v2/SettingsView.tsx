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
          <button className="btn btn-primary btn-sm" onClick={() => setInviting(true)} disabled={!!note}><UserPlus size={16} /> Add person</button>
        </div>
        
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
                  {!m.active ? <span className="text-red-500 bg-red-50 px-2 py-1 rounded-md">Disabled</span> : m.invited ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Invite sent</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Active</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {inviting && <InviteModal onClose={() => setInviting(false)} defaultRole={selectedRole} />}
        {editing && <EditMember member={editing} isMe={editing.id === meId} onClose={() => setEditing(null)} />}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Team Management</h2>
      </div>
      
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

function InviteModal({ onClose, defaultRole }: { onClose: () => void; defaultRole?: string }) {
  const [v, setV] = useState({ email: '', fullName: '', role: defaultRole || 'sales' })
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

import { deleteMember } from '@/app/dashboard/actions'

function EditMember({ member, isMe, onClose }: { member: Member; isMe: boolean; onClose: () => void }) {
  const [v, setV] = useState({ fullName: member.fullName, role: member.role, capacity: member.capacity ?? 150, active: member.active })
  const { run, pending, error } = useAction()
  const { run: runDelete, pending: deleting, error: deleteError } = useAction()
  
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
        
        <ErrorNote error={error || deleteError} />
        
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
          {!isMe ? (
            <button 
              type="button" 
              className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
              disabled={deleting || pending}
              onClick={() => {
                if (confirm(`Are you sure you want to completely delete ${member.fullName || 'this user'}? This action cannot be undone.`)) {
                  runDelete(() => deleteMember(member.id), onClose)
                }
              }}
            >
              {deleting ? 'Deleting...' : 'Delete User'}
            </button>
          ) : <div></div>}
          
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={pending || deleting}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={pending || deleting}>{(pending && !deleting) && <Spinner size={14} />} Save</button>
          </div>
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
