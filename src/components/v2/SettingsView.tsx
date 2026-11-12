'use client'

import { useEffect, useState } from 'react'
import type { Profile } from '@/lib/auth'
import { INVITE_ROLES, type InviteRole, type Role } from '@/lib/config'
import {
  setCadence,
  inviteTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  updateTeamMember,
  deleteTeamMember,
} from '@/app/dashboard/actions'
import { Modal, ConfirmModal, useAction, ErrorNote, Spinner, SaveLabel, toast, InfoTip } from '@/components/ui'
import {
  UserPlus,
  Pencil,
  Users,
  Building2,
  Mail,
  MessageSquare,
  Shield,
  Briefcase,
  Calendar,
  CalendarClock,
  Timer,
  ShieldCheck,
  Check,
  Copy,
  RotateCw,
  Trash2,
  Search,
  Sparkles,
  Clock,
  Info,
} from 'lucide-react'

export type OptOut = {
  id: string; identifier: string; channel: string; reason: string | null
  source: string | null; createdAt: string; business: string | null
}

const STEPS = [
  { key: 'Follow up 1', label: 'First contact to Follow-up 1', step: 'Step 1' },
  { key: 'Follow up 2', label: 'Follow-up 1 to Follow-up 2', step: 'Step 2' },
  { key: 'Follow up 3', label: 'Follow-up 2 to Final check', step: 'Step 3' },
]

export function SettingsView({ me, isAdmin, cadence, optOuts = [], initialTeamMembers = [] }: {
  me: Profile; isAdmin: boolean
  cadence: { step_name: string; days_delay: number }[]; optOuts?: OptOut[]
  initialTeamMembers?: TeamMember[]
}) {
  return (
    <div className="w-full max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <MyAccount me={me} />
      {isAdmin && <TeamManagement me={me} initialMembers={initialTeamMembers} />}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Timing cadence={cadence} />
          <AudienceTiming cadence={cadence} />
        </div>
      )}
      {isAdmin && <DoNotContact list={optOuts} />}
    </div>
  )
}

// ---------- My account ----------
function MyAccount({ me }: { me: Profile }) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold text-base text-slate-900">My account</h2>
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

// ---------- Team & Invites Management (Dynamic Live Integration) ----------
export type TeamRole = Role

export type TeamMember = {
  id: string
  name: string
  email: string
  role: TeamRole
  status: 'active' | 'inactive' | 'pending'
  source?: 'admin_panel' | 'sales_direct'
  joinedOrInvitedAt: string
  actionLink?: string
}

const ROLE_INFO: Record<TeamRole, { label: string; icon: any; color: string; bg: string; border: string; desc: string }> = {
  sales: {
    label: 'Sales Representative',
    icon: Briefcase,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    desc: 'Works pipeline leads, sends outreach, schedules follow-ups',
  },
  consultant: {
    label: 'Consultant',
    icon: Calendar,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    desc: 'Conducts demos and booked client consultations',
  },
  sales_consultant: {
    label: 'Sales + Consultant',
    icon: Users,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    desc: 'Works leads and outreach, and runs the consultations',
  },
  admin: {
    label: 'Administrator',
    icon: Shield,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    desc: 'Full access to pipeline settings, cadences, and team management',
  },
}

function TeamManagement({ me, initialMembers = [] }: { me: Profile; initialMembers?: TeamMember[] }) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
  const [actionLinks, setActionLinks] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'active' | 'pending' | 'admin_panel' | 'sales_direct'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)

  // Custom confirmation modal (replaces native browser alert/confirm UI)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'revoke' | 'delete'
    member: TeamMember
    isPending: boolean
  } | null>(null)

  // Sync state if initialMembers changes from revalidation
  useEffect(() => {
    if (initialMembers && initialMembers.length > 0) {
      setMembers(initialMembers)
    }
  }, [initialMembers])

  // Invite form state
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InviteRole>('sales')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [inviteErrors, setInviteErrors] = useState<{ name?: string; email?: string }>({})

  const activeCount = members.filter(m => m.status === 'active').length
  const pendingCount = members.filter(m => m.status === 'pending').length
  const adminPanelCount = members.filter(m => m.source === 'admin_panel').length
  const salesDirectCount = members.filter(m => m.source === 'sales_direct').length

  const filteredMembers = members.filter(m => {
    if (tab === 'active' && m.status !== 'active') return false
    if (tab === 'pending' && m.status !== 'pending') return false
    if (tab === 'admin_panel' && m.source !== 'admin_panel') return false
    if (tab === 'sales_direct' && m.source !== 'sales_direct') return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  const handleOpenModal = () => {
    setInviteName('')
    setInviteEmail('')
    setInviteRole('sales')
    setFormError(null)
    setInviteErrors({})
    setIsModalOpen(true)
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const name = inviteName.trim()
    const email = inviteEmail.trim().toLowerCase()
    const errs: { name?: string; email?: string } = {}

    if (!name) {
      errs.name = 'Please enter a full name.'
    }
    if (!email) {
      errs.email = 'Please provide a work email address.'
    } else if (!email.includes('@') || !email.includes('.')) {
      errs.email = 'Please provide a valid work email address.'
    }

    setInviteErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsSubmitting(true)
    try {
      const res = await inviteTeamMember({ fullName: name, email, role: inviteRole })
      if (!res.ok) {
        setFormError(res.error)
        setIsSubmitting(false)
        return
      }

      if (res.data?.actionLink && res.data?.id) {
        setActionLinks(prev => ({ ...prev, [res.data!.id]: res.data!.actionLink! }))
      }

      const newMember: TeamMember = {
        id: res.data?.id || `usr-${Date.now()}`,
        name,
        email,
        role: inviteRole,
        status: 'pending',
        source: 'sales_direct',
        joinedOrInvitedAt: 'Invited just now',
        actionLink: res.data?.actionLink,
      }

      setMembers(prev => [newMember, ...prev.filter(m => m.email.toLowerCase() !== email)])
      setIsSubmitting(false)
      setIsModalOpen(false)
      toast.success(`Invitation email sent to ${email}.`)
    } catch (err: any) {
      setFormError(err?.message || 'Could not send invitation. Check network connection.')
      setIsSubmitting(false)
    }
  }

  const handleCopyInviteLink = async (member: TeamMember) => {
    let link = actionLinks[member.id] || member.actionLink
    if (!link) {
      setBusyActionId(`copy-${member.id}`)
      try {
        const res = await resendTeamInvite(member.email)
        if (res.ok && res.data?.actionLink) {
          link = res.data.actionLink
          setActionLinks(prev => ({ ...prev, [member.id]: res.data!.actionLink! }))
        } else if (!res.ok) {
          toast.error(res.error || 'Could not retrieve invite link.')
          return
        }
      } catch {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sales.selfera.co.uk'
        link = `${origin}/auth/set-password`
      } finally {
        setBusyActionId(null)
      }
    }

    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedId(member.id)
        toast.success('Invite setup link copied to clipboard.')
        setTimeout(() => setCopiedId(null), 2500)
      }).catch(() => {
        toast.error('Could not copy link to clipboard.')
      })
    }
  }

  const handleResend = async (member: TeamMember) => {
    setBusyActionId(`resend-${member.id}`)
    try {
      const res = await resendTeamInvite(member.email)
      if (!res.ok) {
        toast.error(res.error)
      } else {
        if (res.data?.actionLink) {
          setActionLinks(prev => ({ ...prev, [member.id]: res.data!.actionLink! }))
        }
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, joinedOrInvitedAt: 'Invited just now' } : m))
        toast.success(`Invitation re-sent to ${member.email}.`)
      }
    } catch {
      toast.error('Failed to resend invite.')
    } finally {
      setBusyActionId(null)
    }
  }

  const handleRevoke = (member: TeamMember) => {
    setConfirmDialog({
      open: true,
      type: 'revoke',
      member,
      isPending: false,
    })
  }

  const handleDeleteMember = (member: TeamMember) => {
    if (member.id === me.id) {
      toast.error('You cannot delete your own active account.')
      return
    }
    setConfirmDialog({
      open: true,
      type: 'delete',
      member,
      isPending: false,
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmDialog) return
    const { type, member } = confirmDialog
    setConfirmDialog(prev => prev ? { ...prev, isPending: true } : null)

    try {
      if (type === 'revoke') {
        const res = await revokeTeamInvite(member.id)
        if (!res.ok) {
          toast.error(res.error)
          setConfirmDialog(prev => prev ? { ...prev, isPending: false } : null)
        } else {
          setMembers(prev => prev.filter(m => m.id !== member.id))
          toast.success(`Invite for ${member.email} has been revoked.`)
          setConfirmDialog(null)
        }
      } else if (type === 'delete') {
        const res = await deleteTeamMember(member.id)
        if (!res.ok) {
          toast.error(res.error)
          setConfirmDialog(prev => prev ? { ...prev, isPending: false } : null)
        } else {
          setMembers(prev => prev.filter(m => m.id !== member.id))
          toast.success(`User "${member.name}" was permanently deleted.`)
          setConfirmDialog(null)
        }
      }
    } catch {
      toast.error(`Failed to ${type === 'revoke' ? 'revoke invite' : 'delete user'}.`)
      setConfirmDialog(prev => prev ? { ...prev, isPending: false } : null)
    }
  }

  // Change role (not for yourself or Admin Panel members)
  const [roleEdit, setRoleEdit] = useState<TeamMember | null>(null)
  const [newRole, setNewRole] = useState<InviteRole>('sales')
  const [savingRole, setSavingRole] = useState(false)
  const openRoleEdit = (m: TeamMember) => {
    setNewRole((INVITE_ROLES as readonly string[]).includes(m.role) ? (m.role as InviteRole) : 'sales')
    setRoleEdit(m)
  }
  const saveRole = async () => {
    if (!roleEdit) return
    setSavingRole(true)
    try {
      const res = await updateTeamMember(roleEdit.id, { role: newRole })
      if (!res.ok) {
        toast.error(res.error)
      } else {
        setMembers(prev => prev.map(m => m.id === roleEdit.id ? { ...m, role: newRole } : m))
        toast.success(`${roleEdit.name} is now ${ROLE_INFO[newRole].label}.`)
        setRoleEdit(null)
      }
    } catch {
      toast.error('Failed to change the role.')
    } finally {
      setSavingRole(false)
    }
  }

  const handleToggleStatus = async (member: TeamMember) => {
    if (member.id === me.id) {
      toast.error('You cannot deactivate your own account.')
      return
    }
    const newActive = member.status !== 'active'
    setBusyActionId(`status-${member.id}`)
    try {
      const res = await updateTeamMember(member.id, { is_active: newActive })
      if (!res.ok) {
        toast.error(res.error)
      } else {
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: newActive ? 'active' : 'inactive' } : m))
        toast.success(`${member.name} is now ${newActive ? 'active' : 'inactive'}.`)
      }
    } catch {
      toast.error('Failed to update member status.')
    } finally {
      setBusyActionId(null)
    }
  }

  return (
    <section className="card space-y-5">
      {/* Header with Title and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-semibold text-base text-slate-900">Team & User Access</h2>
          <p className="text-sm text-muted">
            Invite colleagues by email so they can set their own password and activate their pipeline profile.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenModal}
          className="btn btn-primary btn-sm flex items-center gap-1.5 shrink-0 shadow-xs"
        >
          <UserPlus size={15} />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
        <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`pb-2 transition-colors border-b-2 font-medium ${
              tab === 'all'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All <span className="text-xs text-slate-400">({members.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`pb-2 transition-colors border-b-2 font-medium ${
              tab === 'active'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Active <span className="text-xs text-slate-400">({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`pb-2 transition-colors border-b-2 font-medium ${
              tab === 'pending'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending <span className="text-xs text-slate-400">({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('admin_panel')}
            className={`pb-2 transition-colors border-b-2 font-medium ${
              tab === 'admin_panel'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Admin Panel <span className="text-xs text-slate-400">({adminPanelCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('sales_direct')}
            className={`pb-2 transition-colors border-b-2 font-medium ${
              tab === 'sales_direct'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Sales Direct <span className="text-xs text-slate-400">({salesDirectCount})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="input !py-1 !pl-8 text-xs w-full"
            placeholder="Filter by name or email..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Team Members Table */}
      <div className="table-wrap overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Pipeline Role</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                  No team members match this filter.
                </td>
              </tr>
            ) : (
              filteredMembers.map(m => {
                const roleConfig = ROLE_INFO[m.role] || ROLE_INFO.sales
                const RoleIcon = roleConfig.icon
                const isPending = m.status === 'pending'
                const isInactive = m.status === 'inactive'
                const isCopied = copiedId === m.id
                const isBusy = busyActionId?.includes(m.id)

                return (
                  <tr key={m.id} className="transition-colors hover:bg-slate-50/60">
                    {/* User Info */}
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-semibold uppercase border border-slate-200/80">
                          {m.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm truncate">{m.name}</span>
                            {m.id === me.id && (
                              <span className="text-xs text-slate-400 font-normal">(You)</span>
                            )}
                            {m.source === 'admin_panel' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400" title="Managed centrally in Admin Panel">
                                <Building2 size={11} className="text-slate-400" /> Admin Panel
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600" title="Added directly in Sales Dashboard">
                                <UserPlus size={11} className="text-blue-500" /> Sales Direct
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 block truncate">{m.email || 'No email registered'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${roleConfig.color}`}>
                          <RoleIcon size={14} className="shrink-0" />
                          <span>{roleConfig.label}</span>
                        </span>
                        {m.id !== me.id && m.source !== 'admin_panel' && (
                          <button
                            type="button"
                            onClick={() => openRoleEdit(m)}
                            disabled={isBusy}
                            className="inline-flex items-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Change role"
                            aria-label={`Change role for ${m.name}`}
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      {isPending ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600">
                            <Clock size={13} className="shrink-0 text-amber-500" />
                            <span>Invite Pending</span>
                          </span>
                          <span className="text-xs text-slate-400 block">{m.joinedOrInvitedAt}</span>
                        </div>
                      ) : isInactive ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span>Deactivated</span>
                          </span>
                          <span className="text-xs text-slate-400 block">{m.joinedOrInvitedAt}</span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                            <Check size={13} className="shrink-0 text-emerald-500" />
                            <span>Active</span>
                          </span>
                          <span className="text-xs text-slate-400 block">{m.joinedOrInvitedAt}</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyInviteLink(m)}
                            disabled={isBusy}
                            className={`btn btn-sm text-xs flex items-center gap-1 transition-colors ${
                              isCopied ? '!bg-emerald-600 !text-white !border-emerald-600' : 'btn-outline'
                            }`}
                            title="Copy setup link"
                          >
                            {isCopied ? <Check size={13} /> : <Copy size={13} />}
                            <span>{isCopied ? 'Copied' : 'Copy link'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResend(m)}
                            disabled={isBusy}
                            className="btn btn-ghost btn-sm text-xs text-slate-600 hover:text-slate-900"
                            title="Resend invite email"
                          >
                            <RotateCw size={13} className={busyActionId === `resend-${m.id}` ? 'animate-spin text-primary' : ''} />
                            <span className="hidden sm:inline">Resend</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(m)}
                            disabled={isBusy}
                            className="btn btn-ghost btn-sm text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Revoke invitation"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : m.id !== me.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(m)}
                            disabled={isBusy}
                            className="btn btn-ghost btn-sm text-xs text-slate-600 hover:text-slate-900"
                          >
                            {isInactive ? 'Activate' : 'Deactivate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m)}
                            disabled={isBusy}
                            className="btn btn-ghost btn-sm text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete user account"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Current session</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Change role */}
      <Modal open={!!roleEdit} onClose={() => setRoleEdit(null)} locked={savingRole} title={roleEdit ? `Change role: ${roleEdit.name}` : 'Change role'}>
        <div className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              Pipeline role <InfoTip align="left" text="Takes effect on their next page load. Leads assigned to them stay with them; reassign in Lead Management if needed." />
            </legend>
            {INVITE_ROLES.map(r => {
              const info = ROLE_INFO[r]
              const Icon = info.icon
              return (
                <label key={r} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${newRole === r ? 'border-primary/40' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="team-role" value={r} checked={newRole === r} onChange={() => setNewRole(r)} />
                  <span className={`inline-flex items-center gap-1.5 font-medium ${info.color}`}><Icon size={14} />{info.label}</span>
                  <span className="ml-auto hidden text-xs text-slate-400 sm:inline">{info.desc}</span>
                </label>
              )
            })}
          </fieldset>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRoleEdit(null)} disabled={savingRole}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={saveRole} disabled={savingRole || newRole === roleEdit?.role}>
              {savingRole && <Spinner size={14} />} Save role
            </button>
          </div>
        </div>
      </Modal>

      {/* Invite Modal */}
      {isModalOpen && (
        <Modal
          title="Invite Team Member"
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {formError}
              </div>
            )}

            <div>
              <label className="label">
                Full Name <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                className={`input ${inviteErrors.name ? '!border-rose-400' : ''}`}
                placeholder="e.g. Sarah Jenkins"
                value={inviteName}
                onChange={e => {
                  setInviteName(e.target.value)
                  if (inviteErrors.name) setInviteErrors(prev => ({ ...prev, name: undefined }))
                }}
                autoFocus
              />
              {inviteErrors.name && <p className="mt-1 text-xs text-rose-600 font-medium">{inviteErrors.name}</p>}
            </div>

            <div>
              <label className="label">
                Work Email <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
              </label>
              <input
                type="email"
                className={`input ${inviteErrors.email ? '!border-rose-400' : ''}`}
                placeholder="e.g. sarah@selfera.co.uk"
                value={inviteEmail}
                onChange={e => {
                  setInviteEmail(e.target.value)
                  if (inviteErrors.email) setInviteErrors(prev => ({ ...prev, email: undefined }))
                }}
              />
              {inviteErrors.email && <p className="mt-1 text-xs text-rose-600 font-medium">{inviteErrors.email}</p>}
            </div>

            <div>
              <label className="label">
                Pipeline Role <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
              </label>
              <select
                className="input"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as InviteRole)}
              >
                {INVITE_ROLES.map(r => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">{ROLE_INFO[inviteRole].desc}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm flex items-center gap-1.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size={14} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Invite</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Modal (replaces browser confirm/alert) */}
      {confirmDialog && (
        <ConfirmModal
          open={confirmDialog.open}
          onClose={() => setConfirmDialog(null)}
          onConfirm={handleConfirmAction}
          isPending={confirmDialog.isPending}
          variant="danger"
          title={confirmDialog.type === 'revoke' ? 'Revoke Invite?' : 'Delete Member?'}
          message={
            confirmDialog.type === 'revoke' ? (
              <span>
                Revoke invite for <strong className="text-slate-900">{confirmDialog.member.name}</strong>?
              </span>
            ) : (
              <span>
                Permanently delete <strong className="text-slate-900">{confirmDialog.member.name}</strong>?
              </span>
            )
          }
          confirmText={confirmDialog.type === 'revoke' ? 'Revoke' : 'Delete'}
          cancelText="Cancel"
        />
      )}
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
    <section className="card flex flex-col justify-between h-full space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-base text-slate-900">Follow-up timing</h2>
          <p className="text-sm text-muted">Working days to wait before sending the next message.</p>
        </div>

        <div className="space-y-2">
          {STEPS.map(s => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-400 shrink-0">{s.step}</span>
                <span className="text-sm font-medium text-slate-800 truncate">{s.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  className="input !h-8 !w-16 text-center font-medium text-sm !px-1"
                  type="number"
                  min={1}
                  max={60}
                  value={days[s.key] ?? 1}
                  onChange={e => setDays({ ...days, [s.key]: Math.max(1, Number(e.target.value)) })}
                  aria-label={s.label}
                />
                <span className="text-sm text-muted">days</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end">
        <button
          className={`btn btn-primary btn-sm ${isSaved('timing') ? '!bg-emerald-600 !opacity-100' : ''}`}
          onClick={save}
          disabled={pending || changed.length === 0}
        >
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

  const PRESETS = [7, 14, 21, 30]

  return (
    <section className="card flex flex-col justify-between h-full space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-base text-slate-900">Client Audience campaign timing</h2>
          <p className="text-sm text-muted">Minimum days between campaign messages to the same person.</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-800">Cooldown window</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                className="input !h-8 !w-16 text-center font-medium text-sm !px-1"
                type="number"
                min={1}
                max={180}
                value={days}
                onChange={e => setDays(Math.max(1, Number(e.target.value)))}
                aria-label="Cooldown window"
              />
              <span className="text-sm text-muted">days</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Presets</span>
            <div className="flex items-center gap-1.5">
              {PRESETS.map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setDays(p)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    days === p
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end">
        <button
          className={`btn btn-primary btn-sm ${isSaved('audience') ? '!bg-emerald-600 !opacity-100' : ''}`}
          onClick={() => run(() => setCadence('Audience gap', days), undefined, { success: 'Campaign gap saved.', key: 'audience' })}
          disabled={pending || days === initial}
        >
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
  inbound: 'Replied STOP',
  stage: 'Moved to Do not contact',
}

function DoNotContact({ list }: { list: OptOut[] }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q
    ? list.filter(o => o.identifier.toLowerCase().includes(q) || o.business?.toLowerCase().includes(q))
    : list
  const isWhatsApp = (o: OptOut) => o.channel?.toLowerCase() === 'whatsapp'

  return (
    <section id="do-not-contact" className="card space-y-3 scroll-mt-20">
      <div>
        <h2 className="flex items-center gap-1.5 font-semibold text-base text-slate-900">
          Do-not-contact
          <InfoTip align="left" text="Nothing is sent to these leads on the channel shown: they opted out, their email bounced, they marked us as spam, they replied STOP on any channel, or the lead was moved to Do not contact." />
        </h2>
        <p className="text-sm text-muted">{list.length} {list.length === 1 ? 'lead' : 'leads'} opted out</p>
      </div>
      {list.length > 5 && (
        <input className="input" placeholder="Search by email, number or business" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search do-not-contact list" />
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
                  {SOURCE_LABEL[o.source || ''] || o.source || 'Added'} ·{' '}
                  {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${isWhatsApp(o) ? 'text-emerald-700' : 'text-sky-700'}`}>
                {isWhatsApp(o) ? <MessageSquare size={13} /> : <Mail size={13} />}
                {o.channel?.toLowerCase() === 'all' ? 'All channels' : o.channel || 'Email'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
