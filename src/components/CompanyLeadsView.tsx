'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Users,
  Clock,
  Plus,
  Mail,
  Phone,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  FileText,
  Copy,
  Check,
  Send,
  UserCheck,
  ThumbsUp,
  MessageCircle,
  X,
  Search,
  Trash2,
} from 'lucide-react'
import { InstagramIcon } from '@/components/Icons'
import type { ExtendedTask, ExtendedLead, ChannelType } from '@/types/database'
import { ReplyChannelModal } from './ReplyChannelModal'
import { SendFollowupModal } from './SendFollowupModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useAddLeadModal } from '@/components/AddLeadModalProvider'
import { formatDate, isDueTodayOrOverdue, addWorkingDays } from '@/lib/dateUtils'
import { getLeadCadenceStep, CADENCE_STEPS } from '@/lib/templateUtils'
import { ServiceBadge } from '@/components/ServiceBadge'
import { CompanyTasksModal } from '@/components/CompanyTasksModal'

interface CompanyLeadsViewProps {
  companyName: string
  initialLeads?: ExtendedLead[]
  initialTasks?: ExtendedTask[]
}

export function CompanyLeadsView({
  companyName,
  initialLeads = [],
  initialTasks = [],
}: CompanyLeadsViewProps) {
  const router = useRouter()
  const { openAddLeadModal } = useAddLeadModal()
  const [leads, setLeads] = useState<ExtendedLead[]>(initialLeads)
  const [tasks, setTasks] = useState<ExtendedTask[]>(initialTasks)
  const tasksDueToday = tasks.filter((t) => {
    if (t.status !== 'open') return false
    if (!isDueTodayOrOverdue(t.due_date)) return false
    const lead = t.leads
    if (lead?.stage && ['Replied', 'Lost', 'Do not contact'].includes(lead.stage)) return false
    if (lead?.stage === 'Interested' && lead.next_follow_up && t.due_date !== lead.next_follow_up) return false
    return true
  })
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)
  const [activeTaskModal, setActiveTaskModal] = useState<ExtendedTask | null>(null)
  const [isCompanyTasksModalOpen, setIsCompanyTasksModalOpen] = useState(false)
  const [followupModalLead, setFollowupModalLead] = useState<ExtendedLead | null>(null)
  const [followupModalTask, setFollowupModalTask] = useState<ExtendedTask | null>(null)
  const [followupModalChannel, setFollowupModalChannel] = useState<ChannelType | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<ExtendedLead | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteLead = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      await supabase.from('tasks').delete().eq('lead_id', deleteTarget.id)
      await supabase.from('activity_log').delete().eq('lead_id', deleteTarget.id)
      const { error } = await supabase.from('leads').delete().eq('id', deleteTarget.id)
      if (error) throw error

      const { logUser } = await import('@/lib/logger')
      await logUser('delete_lead', 'lead', deleteTarget.id, {
        business_name: deleteTarget.business_name,
        lead_code: deleteTarget.lead_code,
      })

      setLeads((prev) => prev.filter((l) => l.id !== deleteTarget.id))
      setTasks((prev) => prev.filter((t) => t.lead_id !== deleteTarget.id))
      showToast(`Lead "${deleteTarget.business_name}" deleted.`)
      setDeleteTarget(null)
      setIsDeleting(false)
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError('Failed to delete lead', err, 'CompanyLeadsView.handleDeleteLead', { leadId: deleteTarget.id })
      showToast('Error deleting lead. Please try again.')
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const refreshCompanyData = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: refreshedLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('business_name', companyName)
        .order('created_at', { ascending: false })
      if (refreshedLeads) {
        setLeads(refreshedLeads as ExtendedLead[])
      }
      const { data: refreshedTasks } = await supabase
        .from('tasks')
        .select('*, leads(*)')
        .eq('status', 'open')
        .order('due_date', { ascending: true })
      if (refreshedTasks) {
        const companyTasks = (refreshedTasks as ExtendedTask[]).filter(
          (t) => t.leads?.business_name === companyName
        )
        setTasks(companyTasks)
      }
    } catch {
      // fallback
    }
  }

  const [modalState, setModalState] = useState<{
    isOpen: boolean
    lead: ExtendedLead | null
    task: ExtendedTask | null
    actionType: 'replied' | 'interested'
  }>({
    isOpen: false,
    lead: null,
    task: null,
    actionType: 'replied',
  })

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const getChannelBadgeClass = (channel?: string) => {
    switch (channel) {
      case 'WhatsApp':
        return 'badge-channel-WhatsApp'
      case 'Email':
        return 'badge-channel-Email'
      case 'Instagram':
        return 'badge-channel-Instagram'
      case 'Phone':
        return 'badge-channel-Phone'
      default:
        return 'badge-neutral'
    }
  }

  const getChannelIcon = (channel?: string) => {
    switch (channel) {
      case 'WhatsApp':
        return <MessageCircle size={13} />
      case 'Email':
        return <Mail size={13} />
      case 'Instagram':
        return <InstagramIcon size={13} />
      case 'Phone':
        return <Phone size={13} />
      default:
        return <ArrowRight size={13} />
    }
  }

  const getWhatsAppLink = (phone?: string, text?: string) => {
    if (!phone) return '#'
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const encoded = encodeURIComponent(text || '')
    return `https://wa.me/${cleanPhone}?text=${encoded}`
  }

  const getInstagramLink = (handle?: string) => {
    if (!handle) return '#'
    const cleanHandle = handle.replace('@', '')
    return `https://instagram.com/${cleanHandle}`
  }

  const handleCopyMessage = (taskId: string, message: string) => {
    navigator.clipboard.writeText(message)
    setCopiedTaskId(taskId)
    setTimeout(() => setCopiedTaskId(null), 2500)
    showToast('Message copied to clipboard!')
  }

  const handleMarkAsSent = async (task: ExtendedTask) => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      if (task.lead_id) {
        await supabase.rpc('record_outreach', {
          p_lead_id: task.lead_id,
          p_action: 'sent',
          p_task_id: task.id,
          p_details: `Manual outreach sent via ${task.leads?.channel || task.channel || 'Manual channel'}`,
        })
      }
      await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setActiveTaskModal(null)

      // Refresh lead stage locally if needed
      setLeads((prev) =>
        prev.map((l) => (l.id === task.lead_id ? { ...l, stage: 'Contacted' } : l))
      )

      const { logUser } = await import('@/lib/logger')
      await logUser('mark_sent', 'task', task.id, {
        lead_id: task.lead_id,
        channel: task.leads?.channel || task.channel,
      })

      showToast(`Outreach recorded for ${task.leads?.business_name || 'lead'}. Next cadence scheduled!`)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Database error'
      showToast(`Error: ${errorMsg}`)
    }
  }

  const handleReplied = async (task: ExtendedTask) => {
    const lead = task.leads as ExtendedLead | undefined
    const hasMultiple =
      lead &&
      Boolean(
        (lead.phone && lead.email) ||
          (lead.phone && lead.instagram_handle) ||
          (lead.email && lead.instagram_handle)
      )

    if (lead && hasMultiple) {
      setActiveTaskModal(null)
      setModalState({
        isOpen: true,
        lead: {
          id: task.lead_id || '',
          business_name: task.leads?.business_name || companyName || 'Prospect Lead',
          channel: (task.channel || task.leads?.channel || 'Email') as ChannelType,
          email: task.leads?.email || task.email || null,
          phone: task.leads?.phone || task.phone,
          instagram_handle: task.leads?.instagram_handle || task.instagram_handle,
          stage: 'Contacted',
          follow_up_count: 1,
          next_follow_up: null,
          assigned_to: null,
          created_at: new Date().toISOString(),
        },
        task,
        actionType: 'replied',
      })
    } else {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        if (task.lead_id) {
          await supabase.rpc('record_outreach', {
            p_lead_id: task.lead_id,
            p_action: 'replied',
            p_task_id: task.id,
          })
        }
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
        setTasks((prev) => prev.filter((t) => t.id !== task.id))
        setActiveTaskModal(null)
        setLeads((prev) =>
          prev.map((l) => (l.id === task.lead_id ? { ...l, stage: 'Replied' } : l))
        )
        showToast(`Marked ${task.leads?.business_name || 'lead'} as Replied. Follow-ups halted.`)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Database error'
        showToast(`Error: ${errorMsg}`)
      }
    }
  }

  const handleInterested = async (task: ExtendedTask) => {
    const lead = task.leads as ExtendedLead | undefined
    const hasMultiple =
      lead &&
      Boolean(
        (lead.phone && lead.email) ||
          (lead.phone && lead.instagram_handle) ||
          (lead.email && lead.instagram_handle)
      )

    if (lead && hasMultiple) {
      setActiveTaskModal(null)
      setModalState({
        isOpen: true,
        lead: {
          id: task.lead_id || '',
          business_name: task.leads?.business_name || companyName || 'Prospect Lead',
          channel: (task.channel || task.leads?.channel || 'Email') as ChannelType,
          email: task.leads?.email || task.email || null,
          phone: task.leads?.phone || task.phone,
          instagram_handle: task.leads?.instagram_handle || task.instagram_handle,
          stage: 'Contacted',
          follow_up_count: 1,
          next_follow_up: null,
          assigned_to: null,
          created_at: new Date().toISOString(),
        },
        task,
        actionType: 'interested',
      })
    } else {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        if (task.lead_id) {
          await supabase.rpc('record_outreach', {
            p_lead_id: task.lead_id,
            p_action: 'interested',
            p_task_id: task.id,
          })
          const nextDateStr = addWorkingDays(2)
          await supabase.from('tasks').insert({
            title: `${task.leads?.business_name || 'Lead'}: Follow-up with Interested Lead`,
            description: 'High interest prospect. Follow-up on proposal / service offerings.',
            lead_id: task.lead_id,
            due_date: nextDateStr,
            status: 'open',
            task_type: 'sales_followup',
          })
        }
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
        setTasks((prev) => prev.filter((t) => t.id !== task.id))
        setActiveTaskModal(null)
        setLeads((prev) =>
          prev.map((l) => (l.id === task.lead_id ? { ...l, stage: 'Interested' } : l))
        )
        showToast(`Marked ${task.leads?.business_name || 'lead'} as Interested!`)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Database error'
        showToast(`Error: ${errorMsg}`)
      }
    }
  }

  const handleModalConfirm = async (selectedChannel: ChannelType, note?: string) => {
    if (modalState.lead && modalState.task) {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        // 1. Explicitly update the primary channel and stage on the lead in Supabase
        const targetStage = modalState.actionType === 'interested' ? 'Interested' : 'Replied'
        await supabase
          .from('leads')
          .update({
            channel: selectedChannel,
            stage: targetStage,
          })
          .eq('id', modalState.lead.id)

        // 2. Call record_outreach stored procedure
        await supabase.rpc('record_outreach', {
          p_lead_id: modalState.lead.id,
          p_action: modalState.actionType,
          p_task_id: modalState.task.id,
          p_details: note || null,
          p_reply_channel: selectedChannel,
        })
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', modalState.task.id)
        setTasks((prev) => prev.filter((t) => t.id !== modalState.task?.id))

        if (modalState.actionType === 'interested') {
          const nextDateStr = addWorkingDays(2)
          await supabase.from('tasks').insert({
            title: `${modalState.lead.business_name}: Follow-up with Interested Lead`,
            description: 'High interest prospect. Follow-up on proposal / service offerings.',
            lead_id: modalState.lead.id,
            due_date: nextDateStr,
            status: 'open',
            task_type: 'sales_followup',
          })
        }

        setLeads((prev) =>
          prev.map((l) => (l.id === modalState.lead?.id ? { ...l, stage: targetStage, channel: selectedChannel } : l))
        )
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Database error'
        showToast(`Error: ${errorMsg}`)
      }

      if (modalState.actionType === 'interested') {
        showToast(`Marked ${modalState.lead.business_name} as Interested via ${selectedChannel}!`)
      } else {
        showToast(`Marked ${modalState.lead.business_name} as Replied via ${selectedChannel}.`)
      }
    }
  }

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case 'Won':
        return { bg: 'transparent', text: '#059669', border: 'transparent' }
      case 'Interested':
        return { bg: 'transparent', text: '#ea580c', border: 'transparent' }
      case 'Replied':
        return { bg: 'transparent', text: '#7c3aed', border: 'transparent' }
      case 'Contacted':
        return { bg: 'transparent', text: '#d97706', border: 'transparent' }
      case 'Lost':
      case 'Do not contact':
        return { bg: 'transparent', text: '#dc2626', border: 'transparent' }
      default:
        return { bg: 'transparent', text: '#64748b', border: 'transparent' }
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '1.25rem',
            right: '1.75rem',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '0.85rem 1.35rem',
            borderRadius: '12px',
            border: '1px solid #1e293b',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle size={17} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="flex items-center justify-between"
        style={{
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid #bae6fd',
            }}
          >
            <Building2 size={19} />
          </div>

          <div>
            <h1
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: '#0f172a',
                margin: '0 0 0.15rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              {companyName || 'Business Overview'}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                <Users size={12} />
                <span>
                  {leads.length} {leads.length === 1 ? 'Lead' : 'Leads'}
                </span>
              </span>

              {tasksDueToday.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setIsCompanyTasksModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#fffbeb',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-amber-100"
                  title="Click to view tasks due today"
                >
                  <Clock size={12} />
                  <span>
                    {tasksDueToday.length} {tasksDueToday.length === 1 ? 'Task Due Today' : 'Tasks Due Today'}
                  </span>
                </button>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle size={12} />
                  <span>Up to Date</span>
                </span>
              )}
            </div>

            {/* Multi-Service Approaches Summary as a dedicated separate row */}
            {leads.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Service Pitch:</span>
                {Array.from(new Set(leads.map((l) => l.current_service || l.initial_service || 'Website Services'))).map((srv) => (
                  <ServiceBadge key={srv} service={srv} size="sm" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Company Actions on the Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() =>
              openAddLeadModal({
                defaultCompany: companyName,
                onSuccess: () => {
                  refreshCompanyData()
                },
              })
            }
            className="btn btn-primary btn-sm"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', gap: '5px', borderRadius: '8px' }}
            title="Pitch another service or add contact for this business"
          >
            <Plus size={14} />
            <span>Pitch Service / Add Contact</span>
          </button>
          <Link
            href={`/leads?search=${encodeURIComponent(companyName)}`}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', borderRadius: '8px', gap: '5px' }}
          >
            <Search size={13} />
            <span>All Leads</span>
          </Link>
        </div>
      </div>

      {/* Unified Leads & Outreach Table */}
      <div
        className="card"
        style={{
          padding: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: 'var(--shadow-xs)',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          style={{
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>
            <Users size={15} style={{ color: 'var(--primary)' }} />
            <span>Contacts & Pipeline Status</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {leads.length} registered {leads.length === 1 ? 'contact' : 'contacts'}
          </span>
        </div>

        {leads.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <p className="text-muted" style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
              No leads currently registered under {companyName}.
            </p>
            <button
              type="button"
              onClick={() =>
                openAddLeadModal({
                  defaultCompany: companyName,
                  onSuccess: () => {
                    refreshCompanyData()
                  },
                })
              }
              className="btn btn-primary btn-sm"
              style={{ padding: '0.45rem 1.15rem', borderRadius: '8px' }}
            >
              + Create First Lead
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.65rem 1.15rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Lead</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Cadence Step</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Stage</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>Outreach / Cadence</th>
                  <th style={{ padding: '0.65rem 1.15rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const leadDueTask = tasksDueToday.find((t) => t.lead_id === lead.id)
                  const anyOpenTask = tasks.find((t) => t.lead_id === lead.id && t.status === 'open')
                  const stageStyle = getStageBadgeColor(lead.stage)
                  const leadStep = getLeadCadenceStep(lead)
                  const stepInfo = CADENCE_STEPS[leadStep]
                  const isCadenceHalted = ['Won', 'Lost', 'Do not contact'].includes(lead.stage)

                  return (
                    <tr
                      key={lead.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: leadDueTask ? '#fffdf5' : 'transparent',
                        borderLeft: leadDueTask ? '3px solid #f59e0b' : '3px solid transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="hover:bg-slate-50"
                    >
                      {/* Lead Identification & Service Pitch */}
                      <td style={{ padding: '0.85rem 1.15rem', verticalAlign: 'middle', whiteSpace: 'nowrap', minWidth: '130px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Link
                              href={`/leads/detail?id=${lead.id}`}
                              style={{
                                fontWeight: 700,
                                color: '#0f172a',
                                textDecoration: 'none',
                                fontSize: '0.875rem',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                              }}
                              className="hover:underline"
                            >
                              {lead.lead_code || lead.business_name}
                            </Link>
                            {leadDueTask && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  border: '1px solid #fde68a',
                                }}
                              >
                                <Clock size={10} /> Task Today
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span
                              className={`badge ${getChannelBadgeClass(lead.channel)}`}
                              style={{ fontSize: '0.72rem', padding: 0, gap: '4px' }}
                            >
                              {getChannelIcon(lead.channel)}
                              <span>{lead.channel}</span>
                            </span>
                          </div>
                          {/* Current Service Pitch */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <ServiceBadge
                              service={lead.current_service || lead.initial_service || 'Website Services'}
                              size="sm"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Cadence Step Column */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {isCadenceHalted ? (
                          <span style={{ fontSize: '0.785rem', color: '#64748b', fontWeight: 500 }}>
                            Cadence Closed
                          </span>
                        ) : lead.stage === 'Replied' || lead.stage === 'Interested' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a' }}>
                              {stepInfo.shortLabel}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                              Lead Responded ({lead.stage})
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a' }}>
                              {stepInfo.shortLabel}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>
                              {stepInfo.timing}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Stage Badge */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'transparent',
                            color: stageStyle.text,
                            padding: 0,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {lead.stage}
                        </span>
                      </td>

                      {/* Outreach / Cadence status */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        {leadDueTask ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const ch = (leadDueTask.channel ||
                                  (leadDueTask.title.match(/\((WhatsApp|Instagram|Email|Phone)\)/i)?.[1] as ChannelType) ||
                                  lead.channel ||
                                  'Email') as ChannelType
                                setFollowupModalLead(lead)
                                setFollowupModalTask(leadDueTask)
                                setFollowupModalChannel(ch)
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#fffbeb',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              className="hover:bg-amber-100"
                              title="Click to choose template and send outreach"
                            >
                              <Clock size={11} />
                              <span>Due Today: {leadDueTask.title}</span>
                            </button>
                          </div>
                        ) : anyOpenTask ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem', color: '#64748b' }}>
                            <span style={{ fontWeight: 500, color: '#334155' }}>{anyOpenTask.title}</span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              Scheduled: {formatDate(anyOpenTask.due_date)}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem', color: '#64748b' }}>
                            <span>Step {lead.follow_up_count || 0}/3</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              Next: {formatDate(lead.next_follow_up) || 'None scheduled'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1.15rem', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setFollowupModalLead(lead)}
                            className="btn btn-primary btn-sm"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              gap: '4px',
                              fontWeight: 600,
                            }}
                            title="Choose template & send message"
                          >
                            <Send size={11} />
                            <span>Reply / Follow-up</span>
                          </button>
                          <Link
                            href={`/leads/detail?id=${lead.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              gap: '4px',
                              fontWeight: 600,
                            }}
                          >
                            <span>Profile</span>
                            <ArrowRight size={12} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(lead)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              color: '#dc2626',
                              borderColor: '#fecaca',
                              backgroundColor: '#fff5f5',
                            }}
                            title={`Delete ${lead.business_name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task Outreach Modal (Quickly execute without cluttering the page) */}
      {activeTaskModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 999,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '1.4rem 1.6rem',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {activeTaskModal.task_type === 'sales_followup' ? 'Follow-up Due' : 'Outreach Task'}
                </span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  {activeTaskModal.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveTaskModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Contact Info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Target Lead:</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {activeTaskModal.leads?.lead_code || activeTaskModal.leads?.business_name}
                </span>
              </div>
              <span className={`badge ${getChannelBadgeClass(activeTaskModal.channel || activeTaskModal.leads?.channel)}`} style={{ fontSize: '0.72rem', padding: 0 }}>
                {activeTaskModal.channel || activeTaskModal.leads?.channel || 'Email'}
              </span>
            </div>

            {/* Pre-composed Message Template */}
            {activeTaskModal.description && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    <FileText size={13} style={{ color: 'var(--primary)' }} />
                    <span>Template Message</span>
                  </div>
                  <button
                    onClick={() => handleCopyMessage(activeTaskModal.id, activeTaskModal.description || '')}
                    className="btn btn-ghost btn-sm"
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      color: copiedTaskId === activeTaskModal.id ? 'var(--success)' : 'var(--primary)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      gap: '4px',
                    }}
                  >
                    {copiedTaskId === activeTaskModal.id ? (
                      <>
                        <Check size={12} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    color: '#1e293b',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {activeTaskModal.description}
                </div>
              </div>
            )}

            {/* Choose from Template button */}
            <button
              type="button"
              onClick={() => {
                const targetLead = leads.find((l) => l.id === activeTaskModal.lead_id) || (activeTaskModal.leads as unknown as ExtendedLead)
                if (targetLead) {
                  const ch = (activeTaskModal.channel ||
                    (activeTaskModal.title.match(/\((WhatsApp|Instagram|Email|Phone)\)/i)?.[1] as ChannelType) ||
                    targetLead.channel ||
                    'Email') as ChannelType
                  setActiveTaskModal(null)
                  setFollowupModalLead(targetLead)
                  setFollowupModalTask(activeTaskModal)
                  setFollowupModalChannel(ch)
                }
              }}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              <FileText size={15} />
              <span>Choose from Template & Compose</span>
            </button>

            {/* Direct Channel Launcher */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(activeTaskModal.channel === 'WhatsApp' || activeTaskModal.leads?.channel === 'WhatsApp') && activeTaskModal.leads?.phone && (
                <a
                  href={getWhatsAppLink(activeTaskModal.leads.phone, activeTaskModal.description || '')}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-whatsapp btn-sm"
                  style={{ flex: 1, padding: '0.55rem 1rem', borderRadius: '8px', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
                >
                  <MessageCircle size={15} />
                  <span>Open WhatsApp</span>
                  <ExternalLink size={12} style={{ opacity: 0.8 }} />
                </a>
              )}

              {(activeTaskModal.channel === 'Instagram' || activeTaskModal.leads?.channel === 'Instagram') && activeTaskModal.leads?.instagram_handle && (
                <a
                  href={getInstagramLink(activeTaskModal.leads.instagram_handle)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-instagram btn-sm"
                  style={{ flex: 1, padding: '0.55rem 1rem', borderRadius: '8px', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
                >
                  <InstagramIcon size={15} />
                  <span>Open Instagram</span>
                  <ExternalLink size={12} style={{ opacity: 0.8 }} />
                </a>
              )}

              {(activeTaskModal.channel === 'Email' || activeTaskModal.leads?.channel === 'Email') && activeTaskModal.leads?.email && (
                <a
                  href={`mailto:${activeTaskModal.leads.email}?subject=${encodeURIComponent(
                    activeTaskModal.title
                  )}&body=${encodeURIComponent(activeTaskModal.description || '')}`}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, padding: '0.55rem 1rem', borderRadius: '8px', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
                >
                  <Mail size={15} />
                  <span>Compose Email</span>
                </a>
              )}

              {(activeTaskModal.channel === 'Phone' || activeTaskModal.leads?.channel === 'Phone') && activeTaskModal.leads?.phone && (
                <a
                  href={`tel:${activeTaskModal.leads.phone}`}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, padding: '0.55rem 1rem', borderRadius: '8px', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
                >
                  <Phone size={15} />
                  <span>Call {activeTaskModal.leads.phone}</span>
                </a>
              )}
            </div>

            {/* Bottom Outcome Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '0.85rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={() => handleReplied(activeTaskModal)}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '7px',
                  color: '#6d28d9',
                  backgroundColor: '#f5f3ff',
                  borderColor: '#ddd6fe',
                  fontSize: '0.785rem',
                  gap: '5px',
                }}
              >
                <UserCheck size={14} />
                <span>Replied</span>
              </button>

              <button
                onClick={() => handleInterested(activeTaskModal)}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '7px',
                  color: '#c2410c',
                  backgroundColor: '#fff7ed',
                  borderColor: '#fed7aa',
                  fontSize: '0.785rem',
                  gap: '5px',
                }}
              >
                <ThumbsUp size={14} />
                <span>Interested</span>
              </button>

              <button
                onClick={() => handleMarkAsSent(activeTaskModal)}
                className="btn btn-primary btn-sm"
                style={{
                  padding: '0.45rem 1.05rem',
                  borderRadius: '7px',
                  fontSize: '0.785rem',
                  gap: '5px',
                }}
              >
                <Send size={14} />
                <span>Mark as Sent</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Channel Reply Source Selection Modal */}
      {modalState.isOpen && modalState.lead && (
        <ReplyChannelModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={handleModalConfirm}
          lead={modalState.lead}
          actionType={modalState.actionType}
        />
      )}

      {/* Interactive Send Follow-up & Reply Modal */}
      {followupModalLead && (
        <SendFollowupModal
          isOpen={!!followupModalLead}
          onClose={() => {
            setFollowupModalLead(null)
            setFollowupModalTask(null)
            setFollowupModalChannel(undefined)
          }}
          lead={followupModalLead}
          initialTask={followupModalTask}
          initialChannel={followupModalChannel}
          onSentSuccess={({ channel, templateName }) => {
            showToast(`Outreach sent via ${channel} using ${templateName}`)
            refreshCompanyData()
          }}
        />
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => !isDeleting && setDeleteTarget(null)}
          onConfirm={handleDeleteLead}
          title="Delete Lead"
          message={`Are you sure you want to delete "${deleteTarget.business_name}"? This action cannot be undone and will permanently remove this lead, their scheduled tasks, and activity logs.`}
          confirmText={isDeleting ? 'Deleting...' : 'Delete Lead'}
          cancelText="Cancel"
          variant="danger"
        />
      )}

      {/* Company Tasks Modal (Opens on header badge click) */}
      {isCompanyTasksModalOpen && (
        <CompanyTasksModal
          isOpen={isCompanyTasksModalOpen}
          companyName={companyName}
          tasks={tasksDueToday}
          leads={leads}
          onClose={() => setIsCompanyTasksModalOpen(false)}
          onActionTask={(task, lead) => {
            setIsCompanyTasksModalOpen(false)
            const ch = (task.channel ||
              (task.title.match(/\((WhatsApp|Instagram|Email|Phone)\)/i)?.[1] as ChannelType) ||
              lead.channel ||
              'Email') as ChannelType
            setFollowupModalLead(lead)
            setFollowupModalTask(task)
            setFollowupModalChannel(ch)
          }}
        />
      )}
    </div>
  )
}
