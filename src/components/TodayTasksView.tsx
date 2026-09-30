'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  Clock,
  MessageCircle,
  Mail,
  Phone,
  ArrowRight,
  ThumbsUp,
  Check,
  Send,
  UserCheck,
  ExternalLink,
  ChevronRight,
  Building2,
  FileText,
  Copy,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { InstagramIcon } from '@/components/Icons'
import type { ExtendedTask, ExtendedLead, ChannelType, StageType } from '@/types/database'
import { ReplyChannelModal } from './ReplyChannelModal'
import { SendFollowupModal } from './SendFollowupModal'
import { useAddLeadModal } from '@/components/AddLeadModalProvider'
import { ServiceBadge } from '@/components/ServiceBadge'

interface TodayTasksViewProps {
  initialTasks?: ExtendedTask[] | null
  initialLeads?: ExtendedLead[] | null
}

export function TodayTasksView({ initialTasks = [], initialLeads = [] }: TodayTasksViewProps) {
  const router = useRouter()
  const { openAddLeadModal } = useAddLeadModal()
  const [tasks, setTasks] = useState<ExtendedTask[]>(initialTasks || [])
  const [leads, setLeads] = useState<ExtendedLead[]>(initialLeads || [])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)
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
  const [followupModalState, setFollowupModalState] = useState<{
    isOpen: boolean
    lead: ExtendedLead | null
    task: ExtendedTask | null
  }>({
    isOpen: false,
    lead: null,
    task: null,
  })

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  useEffect(() => {
    if (initialTasks) {
      setTasks(initialTasks)
    }
  }, [initialTasks])

  useEffect(() => {
    if (initialLeads) {
      setLeads(initialLeads)
    }
  }, [initialLeads])

  const openTasks = tasks.filter((t) => t.status === 'open')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  const salesFollowupCount = openTasks.filter((t) => t.task_type === 'sales_followup').length
  const generalTaskCount = openTasks.filter((t) => t.task_type !== 'sales_followup').length

  // Group open tasks by company/business name and calculate leads count under that business
  const companyGroups = React.useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        companyName: string
        tasks: ExtendedTask[]
        allCompanyLeads: ExtendedLead[]
        totalLeadsCount: number
      }
    >()

    const generalTasks: ExtendedTask[] = []

    openTasks.forEach((task) => {
      const bizName = task.leads?.business_name?.trim()
      if (!bizName) {
        generalTasks.push(task)
        return
      }

      const key = bizName.toLowerCase()
      if (!groupsMap.has(key)) {
        // Find all leads for this company/business name in the complete leads list
        const matchingLeads = leads.filter(
          (l) => l.business_name && l.business_name.trim().toLowerCase() === key
        )
        const taskLeadIds = new Set<string>()
        if (task.lead_id) taskLeadIds.add(task.lead_id)

        groupsMap.set(key, {
          companyName: bizName,
          tasks: [task],
          allCompanyLeads: matchingLeads,
          totalLeadsCount: Math.max(matchingLeads.length, taskLeadIds.size, 1),
        })
      } else {
        const group = groupsMap.get(key)!
        group.tasks.push(task)
        if (task.lead_id && !group.allCompanyLeads.some((l) => l.id === task.lead_id)) {
          group.totalLeadsCount = Math.max(group.totalLeadsCount, group.allCompanyLeads.length + 1)
        }
      }
    })

    return {
      companies: Array.from(groupsMap.values()),
      generalTasks,
    }
  }, [openTasks, leads])

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
      
      const { logUser } = await import('@/lib/logger')
      await logUser('mark_sent', 'task', task.id, {
        lead_id: task.lead_id,
        channel: task.leads?.channel || task.channel,
      })

      showToast(`Outreach recorded for ${task.leads?.business_name || 'lead'}. Next cadence scheduled!`)
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError('Error marking task as sent', err, 'TodayTasksView.handleMarkAsSent', { taskId: task.id })
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
      setModalState({
        isOpen: true,
        lead: {
          id: task.lead_id || '',
          business_name: task.leads?.business_name || 'Prospect Lead',
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
      setModalState({
        isOpen: true,
        lead: {
          id: task.lead_id || '',
          business_name: task.leads?.business_name || 'Prospect Lead',
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
        }
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
        setTasks((prev) => prev.filter((t) => t.id !== task.id))
        showToast(`Marked ${task.leads?.business_name || 'lead'} as Interested! 2-day reminder set.`)
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

        // 1. Explicitly update the primary channel and stage in the database
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

        // 3. Mark task completed
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', modalState.task.id)
        setTasks((prev) => prev.filter((t) => t.id !== modalState.task?.id))
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Database error'
        showToast(`Error: ${errorMsg}`)
      }

      if (modalState.actionType === 'interested') {
        showToast(
          `Marked ${modalState.lead.business_name} as Interested via ${selectedChannel}! 2-day proposal reminder scheduled.`
        )
      } else {
        showToast(
          `Marked ${modalState.lead.business_name} as Replied via ${selectedChannel}. Follow-up channel switched to ${selectedChannel}.`
        )
      }
    }
  }

  const handleComplete = async (taskId: string) => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      showToast('Task marked as completed!')
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Database error'
      showToast(`Error: ${errorMsg}`)
    }
  }

  const handleCopyMessage = (taskId: string, message: string) => {
    navigator.clipboard.writeText(message)
    setCopiedTaskId(taskId)
    setTimeout(() => setCopiedTaskId(null), 2500)
    showToast('Message copied to clipboard!')
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
        return <MessageCircle size={14} />
      case 'Email':
        return <Mail size={14} />
      case 'Instagram':
        return <InstagramIcon size={14} />
      case 'Phone':
        return <Phone size={14} />
      default:
        return <ArrowRight size={14} />
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


  const renderTaskCard = (task: ExtendedTask) => {
    const channel = task.leads?.channel || task.channel || 'Email'
    const phone = task.leads?.phone || task.phone || ''
    const instagramHandle = task.leads?.instagram_handle || task.instagram_handle || ''
    const email = task.leads?.email || task.email || ''
    const isFollowup = task.task_type === 'sales_followup'
    const isCopied = copiedTaskId === task.id

    return (
      <div
        key={task.id}
        style={{
          padding: '1.25rem 1.45rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#fafbfc',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        {/* Top metadata strip */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            {isFollowup ? (
              <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: 0 }}>
                Follow-up Due
              </span>
            ) : (
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem', padding: 0 }}>
                General Task
              </span>
            )}

            <span className={`badge ${getChannelBadgeClass(channel)}`} style={{ fontSize: '0.75rem', padding: 0, gap: '4px' }}>
              {getChannelIcon(channel)}
              <span>{channel}</span>
            </span>

            {task.leads && (task.leads.current_service || task.leads.initial_service) && (
              <ServiceBadge
                service={task.leads.current_service || task.leads.initial_service}
                initialService={task.leads.initial_service}
                showPivot={true}
                size="sm"
              />
            )}

            {task.leads && (
              <Link
                href={`/leads/detail?id=${task.lead_id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  textDecoration: 'none',
                }}
                title="Target lead for this action"
              >
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}>Target Lead:</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  {task.leads.lead_code || task.leads.business_name}
                </span>
                <ExternalLink size={11} style={{ color: '#94a3b8' }} />
              </Link>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#b45309',
              padding: 0,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Clock size={12} />
            <span>Due: Today</span>
          </div>
        </div>

        {/* Title & Contact row */}
        <div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
            {task.title}
          </h4>

          {task.leads && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
              {phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '0.15rem 0.5rem', borderRadius: '5px' }}>
                  <Phone size={11} style={{ color: '#64748b' }} />
                  <span>{phone}</span>
                </div>
              )}
              {email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '0.15rem 0.5rem', borderRadius: '5px' }}>
                  <Mail size={11} style={{ color: '#64748b' }} />
                  <span>{email}</span>
                </div>
              )}
              {instagramHandle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '0.15rem 0.5rem', borderRadius: '5px' }}>
                  <InstagramIcon size={11} style={{ color: '#64748b' }} />
                  <span>@{instagramHandle}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message template */}
        {task.description && (
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div className="flex justify-between items-center">
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FileText size={13} style={{ color: 'var(--primary)' }} />
                <span>Outreach Message Template</span>
              </div>
              <button
                onClick={() => handleCopyMessage(task.id, task.description || '')}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  color: isCopied ? 'var(--success)' : 'var(--primary)',
                  backgroundColor: isCopied ? '#ecfdf5' : '#ffffff',
                  border: '1px solid',
                  borderColor: isCopied ? '#a7f3d0' : '#e2e8f0',
                  borderRadius: '6px',
                  fontWeight: 600,
                  gap: '4px',
                }}
                title="Copy message to clipboard"
              >
                {isCopied ? (
                  <>
                    <Check size={12} /> <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} /> <span>Copy Message</span>
                  </>
                )}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
              {task.description}
            </p>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-200 flex-wrap gap-2">
          {/* Direct launchers */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const targetLead =
                  leads.find((l) => l.id === task.lead_id) ||
                  (task.leads
                    ? ({
                        id: task.lead_id || '',
                        business_name: task.leads.business_name,
                        channel: task.leads.channel,
                        phone: task.leads.phone || phone,
                        email: task.leads.email || email,
                        instagram_handle: task.leads.instagram_handle || instagramHandle,
                        stage: (task.leads.stage || 'Contacted') as StageType,
                        follow_up_count: 1,
                        next_follow_up: null,
                        assigned_to: null,
                        created_at: new Date().toISOString(),
                      } as ExtendedLead)
                    : null)

                if (targetLead) {
                  setFollowupModalState({
                    isOpen: true,
                    lead: targetLead,
                    task,
                  })
                }
              }}
              className="btn btn-primary btn-sm"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                gap: '6px',
                fontWeight: 700,
              }}
            >
              <Send size={14} />
              <span>Choose Template & Send</span>
            </button>

            {channel === 'WhatsApp' && phone && (
              <a
                href={getWhatsAppLink(phone, task.description || '')}
                target="_blank"
                rel="noreferrer"
                className="btn btn-whatsapp btn-sm"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', gap: '6px' }}
              >
                <MessageCircle size={15} />
                <span>Open WhatsApp</span>
                <ExternalLink size={11} style={{ opacity: 0.85 }} />
              </a>
            )}

            {channel === 'Instagram' && instagramHandle && (
              <a
                href={getInstagramLink(instagramHandle)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-instagram btn-sm"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', gap: '6px' }}
              >
                <InstagramIcon size={15} />
                <span>Open Instagram</span>
                <ExternalLink size={11} style={{ opacity: 0.85 }} />
              </a>
            )}

            {channel === 'Email' && email && (
              <a
                href={`mailto:${email}?subject=${encodeURIComponent(task.title)}&body=${encodeURIComponent(task.description || '')}`}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', gap: '6px' }}
              >
                <Mail size={15} />
                <span>Compose Email</span>
              </a>
            )}

            {channel === 'Phone' && phone && (
              <a
                href={`tel:${phone}`}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', gap: '6px' }}
              >
                <Phone size={15} />
                <span>Call {phone}</span>
              </a>
            )}

            {/* Secondary shortcuts */}
            {channel !== 'WhatsApp' && phone && (
              <a
                href={getWhatsAppLink(phone, task.description || '')}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.75rem', gap: '4px' }}
                title={`WhatsApp: ${phone}`}
              >
                <MessageCircle size={12} />
                <span>WhatsApp</span>
              </a>
            )}

            {channel !== 'Email' && email && (
              <a
                href={`mailto:${email}?subject=${encodeURIComponent(task.title)}&body=${encodeURIComponent(task.description || '')}`}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', color: '#2563eb', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '0.75rem', gap: '4px' }}
                title={`Email: ${email}`}
              >
                <Mail size={12} />
                <span>Email</span>
              </a>
            )}

            {channel !== 'Instagram' && instagramHandle && (
              <a
                href={getInstagramLink(instagramHandle)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', color: '#db2777', backgroundColor: '#fdf2f8', border: '1px solid #fbcfe8', fontSize: '0.75rem', gap: '4px' }}
                title={`Instagram: @${instagramHandle}`}
              >
                <InstagramIcon size={12} />
                <span>Instagram</span>
              </a>
            )}
          </div>

          {/* Progression actions */}
          <div className="flex items-center gap-2">
            {isFollowup ? (
              <>
                <button
                  onClick={() => handleReplied(task)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: '#6d28d9', borderColor: '#ddd6fe', backgroundColor: '#f5f3ff', gap: '6px', fontSize: '0.8rem' }}
                >
                  <UserCheck size={14} />
                  <span>Replied</span>
                </button>

                <button
                  onClick={() => handleInterested(task)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: '#c2410c', borderColor: '#fed7aa', backgroundColor: '#fff7ed', gap: '6px', fontSize: '0.8rem' }}
                >
                  <ThumbsUp size={14} />
                  <span>Interested</span>
                </button>

                <button
                  onClick={() => handleMarkAsSent(task)}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.5rem 1.15rem', borderRadius: '8px', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)', gap: '6px', fontSize: '0.8rem' }}
                >
                  <Send size={14} />
                  <span>Mark as sent</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleComplete(task.id)}
                className="btn btn-success btn-sm"
                style={{ padding: '0.5rem 1.15rem', borderRadius: '8px', gap: '6px', fontSize: '0.8rem' }}
              >
                <Check size={14} />
                <span>Complete Task</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2.5rem',
            right: '2.5rem',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '0.9rem 1.4rem',
            borderRadius: '12px',
            border: '1px solid #1e293b',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle size={18} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
            Today&apos;s Sales Queue
          </h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Select a company card to review all associated leads and action pending outreach tasks.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAddLeadModal()}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', borderRadius: '8px' }}
          >
            + New Lead
          </button>
          <Link href="/leads" className="btn btn-primary btn-sm" style={{ padding: '0.45rem 0.95rem', fontSize: '0.8125rem', borderRadius: '8px' }}>
            All Leads <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="stat-grid" style={{ gap: '0.75rem', marginBottom: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Companies to Action</span>
          <span className="stat-value" style={{ fontSize: '1.45rem', color: 'var(--primary)' }}>
            {companyGroups.companies.length}
          </span>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Pending Tasks</span>
          <span className="stat-value" style={{ fontSize: '1.45rem' }}>{openTasks.length}</span>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Sales Follow-ups</span>
          <span className="stat-value" style={{ fontSize: '1.45rem', color: '#0284c7' }}>
            {salesFollowupCount}
          </span>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Completed Today</span>
          <span className="stat-value" style={{ fontSize: '1.45rem', color: 'var(--success)' }}>
            {completedTasks.length}
          </span>
        </div>
      </div>

      {/* Business Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {companyGroups.companies.length === 0 && companyGroups.generalTasks.length === 0 ? (
          <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '3.5rem 2rem', borderRadius: '12px' }}>
            <CheckCircle
              size={48}
              style={{ color: 'var(--success)', margin: '0 auto 1rem', opacity: 0.9 }}
            />
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>You&apos;re completely caught up!</h2>
            <p className="text-muted" style={{ maxWidth: '440px', margin: '0 auto 1.5rem', fontSize: '0.875rem' }}>
              No open tasks in this queue right now. You can check upcoming leads or add new prospective accounts.
            </p>
            <div className="flex gap-2.5 justify-center">
              <Link href="/leads" className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 1rem' }}>
                Review All Leads
              </Link>
              <button
                type="button"
                onClick={() => openAddLeadModal()}
                className="btn btn-primary btn-sm"
                style={{ padding: '0.45rem 1rem' }}
              >
                Add New Lead
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Business Cards (Navigates to Dedicated Company Page) */}
            {companyGroups.companies.map((group) => {
              return (
                <Link
                  key={group.companyName}
                  href={`/company?name=${encodeURIComponent(group.companyName)}`}
                  className="card card-hover"
                  style={{
                    padding: '1rem 1.15rem',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    boxShadow: 'var(--shadow-xs)',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div>
                    {/* Top Row: Icon + Company Name + Arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '9px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          <Building2 size={18} />
                        </div>

                        <h2
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            margin: 0,
                            letterSpacing: '-0.015em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={group.companyName}
                        >
                          {group.companyName}
                        </h2>
                      </div>

                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: '#f8fafc',
                          color: '#64748b',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ChevronRight size={14} />
                      </div>
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                      {/* Number of Leads under that business */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: 'transparent',
                          color: '#1d4ed8',
                          border: 'none',
                          padding: 0,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                        title={`Total leads registered under ${group.companyName}`}
                      >
                        <Users size={12} />
                        <span>
                          {group.totalLeadsCount} {group.totalLeadsCount === 1 ? 'Lead' : 'Leads'}
                        </span>
                      </span>

                      {/* Tasks Status Badge */}
                      {group.tasks.length > 0 ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'transparent',
                            color: '#b45309',
                            border: 'none',
                            padding: 0,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          <Clock size={12} />
                          <span>
                            {group.tasks.length} {group.tasks.length === 1 ? 'Task Today' : 'Tasks Today'}
                          </span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'transparent',
                            color: '#15803d',
                            border: 'none',
                            padding: 0,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          <Check size={12} />
                          <span>Done Today</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom / Footer Link */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.55rem',
                      borderTop: '1px solid #f1f5f9',
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}
                  >
                    <span>Action leads</span>
                    <span
                      style={{
                        color: 'var(--primary)',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      View Leads ({group.totalLeadsCount}) &rarr;
                    </span>
                  </div>
                </Link>
              )
            })}

            {/* General Tasks if any */}
            {companyGroups.generalTasks.length > 0 && (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  boxShadow: 'var(--shadow-xs)',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
                  <CheckCircle size={18} style={{ color: '#64748b' }} />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    General & Administrative Tasks
                  </h3>
                  <span
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    {companyGroups.generalTasks.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {companyGroups.generalTasks.map((task) => renderTaskCard(task))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
      {followupModalState.isOpen && followupModalState.lead && (
        <SendFollowupModal
          isOpen={followupModalState.isOpen}
          onClose={() => setFollowupModalState({ isOpen: false, lead: null, task: null })}
          lead={followupModalState.lead}
          initialTask={followupModalState.task}
          onSentSuccess={({ channel, templateName }) => {
            showToast(`Outreach sent via ${channel} using ${templateName}`)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
