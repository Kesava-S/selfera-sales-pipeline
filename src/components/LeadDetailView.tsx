'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  Activity,
  Send,
  UserCheck,
  Trophy,
  XCircle,
  Ban,
  Clock,
  ExternalLink,
  Plus,
  ShieldCheck,
  CheckCircle,
  Check,
  Layers,
  Edit3,
  Trash2,
  ArrowRightLeft,
  ArrowRight,
} from 'lucide-react'
import type { ActivityLog, ChannelType, ExtendedLead, StageType, LeadServiceHistory } from '@/types/database'
import { InstagramIcon } from '@/components/Icons'
import { formatDate, formatDateTime, addWorkingDays, addCalendarDays } from '@/lib/dateUtils'
import { ReplyChannelModal } from '@/components/ReplyChannelModal'
import { EditLeadModal } from '@/components/EditLeadModal'
import { SendFollowupModal } from '@/components/SendFollowupModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ChangeServiceModal } from '@/components/ChangeServiceModal'
import { ServiceBadge } from '@/components/ServiceBadge'
import { buildPivotChain } from '@/lib/serviceUtils'

export function LeadDetailView({
  leadId,
  initialLead,
  initialActivities,
}: {
  leadId: string
  initialLead: ExtendedLead | null
  initialActivities: ActivityLog[] | null
}) {
  const router = useRouter()
  const [lead, setLead] = useState<ExtendedLead | null>(initialLead)
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivities || [])
  const [noteText, setNoteText] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [replyModalAction, setReplyModalAction] = useState<'replied' | 'interested'>('replied')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [changeServiceModalOpen, setChangeServiceModalOpen] = useState(false)
  const [changeServiceModalTab, setChangeServiceModalTab] = useState<'offering' | 'pivot'>('offering')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sendFollowupModalOpen, setSendFollowupModalOpen] = useState(false)
  const [selectedComposerChannel, setSelectedComposerChannel] = useState<ChannelType | undefined>(undefined)
  const [serviceHistory, setServiceHistory] = useState<LeadServiceHistory[]>([])

  const pivotChain = useMemo(() => {
    return buildPivotChain(lead?.initial_service, serviceHistory, lead?.current_service)
  }, [lead?.initial_service, lead?.current_service, serviceHistory])

  // Fetch service history
  useEffect(() => {
    if (!lead?.id) return
    const fetchHistory = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('lead_service_history')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: true })
        if (data) setServiceHistory(data as LeadServiceHistory[])
      } catch {
        // safe fallback
      }
    }
    fetchHistory()
  }, [lead?.id])

  const handleServicePivotSuccess = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      if (lead) {
        const { data: refreshedLead } = await supabase.from('leads').select('*').eq('id', lead.id).single()
        if (refreshedLead) setLead(refreshedLead as ExtendedLead)
        const { data: refreshedActs } = await supabase
          .from('activity_log')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
        if (refreshedActs) setActivities(refreshedActs)
        const { data: refreshedHist } = await supabase
          .from('lead_service_history')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: true })
        if (refreshedHist) setServiceHistory(refreshedHist as LeadServiceHistory[])
      }
    } catch (err) {
      console.error('Failed to refresh after service pivot:', err)
    }
    showToast('Service transition logged successfully!')
  }

  const handleDeleteLead = async () => {
    if (!lead) return
    setIsDeleting(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Delete associated tasks
      await supabase.from('tasks').delete().eq('lead_id', lead.id)

      // Delete associated activity logs
      await supabase.from('activity_log').delete().eq('lead_id', lead.id)

      // Delete lead record
      const { error } = await supabase.from('leads').delete().eq('id', lead.id)
      if (error) throw error

      // Log User audit
      const { logUser } = await import('@/lib/logger')
      await logUser('delete_lead', 'lead', lead.id, {
        business_name: lead.business_name,
        lead_code: lead.lead_code,
      })

      showToast(`Lead "${lead.business_name}" was permanently deleted.`)
      setTimeout(() => {
        router.push('/leads')
      }, 500)
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError('Failed to delete lead', err, 'LeadDetailView.handleDeleteLead', { leadId: lead.id })
      showToast('Error deleting lead. Please try again.')
      setIsDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const handleOpenComposer = (channel?: ChannelType) => {
    setSelectedComposerChannel(channel || lead?.channel || 'Email')
    setSendFollowupModalOpen(true)
  }

  useEffect(() => {
    if (initialLead) setLead(initialLead)
    if (initialActivities) setActivities(initialActivities)
  }, [initialLead, initialActivities])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  if (!lead) {
    return (
      <div className="card text-center" style={{ padding: '4rem 2rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Lead Not Found</h2>
        <p className="text-muted" style={{ maxWidth: '420px', margin: '0 auto 1.5rem' }}>
          The requested lead (ID: {leadId}) could not be located in this workspace.
        </p>
        <Link href="/leads" className="btn btn-primary">
          Return to Leads Directory
        </Link>
      </div>
    )
  }

  const channelOptionsCount = [
    lead.phone ? 'WhatsApp' : null,
    lead.email ? 'Email' : null,
    lead.instagram_handle ? 'Instagram' : null,
    lead.phone ? 'Phone' : null,
  ].filter(Boolean).length

  const hasMultipleChannels = channelOptionsCount > 1

  const handleAction = async (
    action: 'sent' | 'replied' | 'interested' | 'won' | 'lost' | 'do_not_contact' | 'new',
    details?: string,
    replyChannel?: ChannelType
  ) => {
    const stageMap: Record<string, StageType> = {
      new: 'New',
      sent: 'Contacted',
      replied: 'Replied',
      interested: 'Interested',
      won: 'Won',
      lost: 'Lost',
      do_not_contact: 'Do not contact',
    }

    const actionLabels = {
      new: 'Stage reset to New prospect lead.',
      sent: `Outreach marked as sent via ${replyChannel || lead.channel}! Next cadence step auto-scheduled.`,
      replied: replyChannel
        ? `Lead replied via ${replyChannel}. Primary channel switched to ${replyChannel}.`
        : 'Lead marked as Replied. Follow-ups halted.',
      interested: replyChannel
        ? `Lead marked as Interested via ${replyChannel}! Primary channel switched to ${replyChannel}.`
        : 'Lead marked as Interested. Follow-up reminder set for +2 days.',
      won: 'Deal marked as Won! 30-day upsell reminder created.',
      lost: 'Lead marked as Lost. Follow-up stopped.',
      do_not_contact: 'Lead marked as Do not contact (PECR compliance).',
    }

    const targetStage = stageMap[action] || lead.stage
    const updatedChannel = replyChannel || lead.channel

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // 1. Explicitly update the primary channel, stage, and auto-set agreed service if won
      const leadUpdatePayload: Record<string, unknown> = {
        channel: updatedChannel,
        stage: targetStage,
      }
      if (targetStage === 'Won' && !lead.agreed_service) {
        leadUpdatePayload.agreed_service = lead.current_service || lead.initial_service || 'Website Services'
      }

      await supabase
        .from('leads')
        .update(leadUpdatePayload)
        .eq('id', lead.id)

      // 2. Execute RPC function
      await supabase.rpc('record_outreach', {
        p_lead_id: lead.id,
        p_action: action,
        p_task_id: null,
        p_details: details || null,
        p_reply_channel: replyChannel || null,
      })

      // 2b. Synchronize open cadence tasks with the new stage
      if (['replied', 'interested', 'won', 'lost', 'do_not_contact'].includes(action)) {
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('lead_id', lead.id)
          .eq('status', 'open')

        if (action === 'interested') {
          const nextDateStr = addWorkingDays(2)
          await supabase.from('tasks').insert({
            title: `${lead.business_name}: Follow-up with Interested Lead`,
            description: 'High interest prospect. Follow-up on proposal / service offerings.',
            lead_id: lead.id,
            due_date: nextDateStr,
            status: 'open',
            task_type: 'sales_followup',
          })
        } else if (action === 'won') {
          const nextDateStr = addCalendarDays(30)
          await supabase.from('tasks').insert({
            title: `${lead.business_name}: 30-Day Check-in & Upsell`,
            description: 'Check-in with client and present additional service offerings.',
            lead_id: lead.id,
            due_date: nextDateStr,
            status: 'open',
            task_type: 'sales_followup',
          })
        }
      }

      // 3. Log channel switch note if updated
      if (replyChannel && replyChannel !== lead.channel) {
        await supabase.from('activity_log').insert({
          lead_id: lead.id,
          action_type: 'note',
          details: `Primary outreach channel switched to ${replyChannel} after client replied.`,
          created_by: 'sales-1',
        })
      }

      // 4. Update UI state immediately
      setLead((prev) =>
        prev
          ? {
              ...prev,
              channel: updatedChannel,
              stage: targetStage,
            }
          : prev
      )

      // 5. Fetch refreshed lead & activity logs
      const { data: refreshedLead } = await supabase.from('leads').select('*').eq('id', lead.id).single()
      if (refreshedLead) {
        setLead({
          ...(refreshedLead as ExtendedLead),
          channel: updatedChannel,
          stage: targetStage,
        })
      }

      const { data: refreshedActs } = await supabase
        .from('activity_log')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
      if (refreshedActs) setActivities(refreshedActs)

      const { logUser } = await import('@/lib/logger')
      await logUser('update_stage', 'lead', lead.id, {
        action,
        replyChannel: updatedChannel,
        details,
      })

      showToast(actionLabels[action])
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError(`Error performing lead action: ${action}`, err, 'LeadDetailView.handleAction', { leadId: lead.id, action })
      const errorMsg = err instanceof Error ? err.message : 'Unknown database error'
      showToast(`Database error: ${errorMsg}`)
    }
  }

  const handleChannelChange = async (newChan: ChannelType) => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.from('leads').update({ channel: newChan }).eq('id', lead.id)
      await supabase.from('activity_log').insert({
        lead_id: lead.id,
        action_type: 'note',
        details: `Primary outreach channel switched to ${newChan}`,
      })
      const { data: refreshedLead } = await supabase.from('leads').select('*').eq('id', lead.id).single()
      if (refreshedLead) setLead(refreshedLead as ExtendedLead)

      const { data: refreshedActs } = await supabase.from('activity_log').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
      if (refreshedActs) setActivities(refreshedActs)

      const { logUser } = await import('@/lib/logger')
      await logUser('switch_channel', 'lead', lead.id, { newChannel: newChan })

      showToast(`Primary follow-up channel switched to ${newChan}`)
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError(`Error switching channel to ${newChan}`, err, 'LeadDetailView.handleChannelChange', { leadId: lead.id, newChan })
      const errorMsg = err instanceof Error ? err.message : 'Unknown database error'
      showToast(`Database error: ${errorMsg}`)
    }
  }

  const triggerReplyFlow = (action: 'replied' | 'interested') => {
    if (hasMultipleChannels) {
      setReplyModalAction(action)
      setReplyModalOpen(true)
    } else {
      handleAction(action)
    }
  }

  const handleStageSelect = (newStage: string) => {
    const stageActionMap: Record<string, 'new' | 'sent' | 'replied' | 'interested' | 'won' | 'lost' | 'do_not_contact'> = {
      'New': 'new',
      'Contacted': 'sent',
      'Replied': 'replied',
      'Interested': 'interested',
      'Won': 'won',
      'Lost': 'lost',
      'Do not contact': 'do_not_contact',
    }
    const action = stageActionMap[newStage]
    if (action === 'replied' || action === 'interested') {
      triggerReplyFlow(action)
    } else if (action) {
      handleAction(action)
    }
  }

  const getStageColorStyles = (stage: string) => {
    switch (stage) {
      case 'New':
        return { backgroundColor: 'transparent', color: '#1d4ed8', border: 'none' }
      case 'Contacted':
        return { backgroundColor: 'transparent', color: '#b45309', border: 'none' }
      case 'Replied':
        return { backgroundColor: 'transparent', color: '#6d28d9', border: 'none' }
      case 'Interested':
        return { backgroundColor: 'transparent', color: '#c2410c', border: 'none' }
      case 'Won':
        return { backgroundColor: 'transparent', color: '#047857', border: 'none' }
      case 'Lost':
        return { backgroundColor: 'transparent', color: '#b91c1c', border: 'none' }
      case 'Do not contact':
        return { backgroundColor: 'transparent', color: '#475569', border: 'none' }
      default:
        return { backgroundColor: 'transparent', color: '#334155', border: 'none' }
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('activity_log').insert({
        lead_id: lead.id,
        action_type: 'note',
        details: noteText.trim(),
        created_by: 'sales-1',
      })
      if (!error) {
        const { data: refreshedActs } = await supabase
          .from('activity_log')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
        if (refreshedActs) setActivities(refreshedActs)
        setNoteText('')
        showToast('Activity note added to timeline!')
      }
    } catch (err) {
      console.error('Failed to add note to database:', err)
    }
  }


  const getWhatsAppLink = (phone?: string) => {
    if (!phone) return '#'
    const clean = phone.replace(/[^0-9]/g, '')
    const defaultText = `Hi ${lead.business_name}, following up regarding our outreach.`
    return `https://wa.me/${clean}?text=${encodeURIComponent(defaultText)}`
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
            padding: '0.85rem 1.4rem',
            borderRadius: '12px',
            border: '1px solid #1e293b',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 9999,
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

      {/* Header Bar - Back navigation removed as requested */}
      <div
        className="flex items-center justify-between"
        style={{
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              margin: '0 0 0.2rem 0',
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            {lead.business_name}
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.825rem',
              color: '#64748b',
            }}
          >
            {lead.lead_code ? (
              <>
                <span style={{ whiteSpace: 'nowrap' }}>
                  Lead ID:{' '}
                  <code
                    style={{
                      backgroundColor: '#f1f5f9',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                      color: '#334155',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lead.lead_code}
                  </code>
                </span>
                <span>•</span>
              </>
            ) : null}
            <span style={{ whiteSpace: 'nowrap' }}>
              Channel: <strong style={{ color: '#0f172a' }}>{lead.channel}</strong>
            </span>
          </div>

          {/* Service Pitch as a dedicated separate row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.825rem',
              color: '#64748b',
              marginTop: '0.35rem',
            }}
          >
            <span style={{ fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Service Pitch:</span>
            <ServiceBadge
              service={lead.current_service || lead.initial_service || 'Website Services'}
              size="sm"
            />
            <button
              type="button"
              onClick={() => {
                setChangeServiceModalTab('offering')
                setChangeServiceModalOpen(true)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--primary)',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                cursor: 'pointer',
                marginLeft: '6px',
                whiteSpace: 'nowrap',
              }}
              title="Click to view complete service offering details and evolution timeline in modal"
            >
              <Layers size={12} />
              <span>View Offering</span>
            </button>
          </div>
        </div>

        {/* Top Header Status Badge (Single source of stage switching is Pipeline Progression below) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b' }}>Status:</span>
            <span
              style={{
                ...getStageColorStyles(lead.stage),
                padding: 0,
                fontSize: '0.85rem',
                fontWeight: 700,
                boxShadow: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {lead.stage}
            </span>
          </div>

          <span
            className="badge badge-neutral"
            style={{ fontSize: '0.825rem', padding: 0, gap: '5px' }}
          >
            <Clock size={13} />
            <span>Step {lead.follow_up_count}/3</span>
          </span>

          {/* Edit Button - Icon Only */}
          <button
            onClick={() => setEditModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: '8px',
              color: '#334155',
              boxShadow: 'var(--shadow-xs)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Edit lead details"
            aria-label="Edit lead details"
          >
            <Edit3 size={15} style={{ color: 'var(--primary)' }} />
          </button>

          {/* Pivot Service Button */}
          <button
            onClick={() => {
              setChangeServiceModalTab('pivot')
              setChangeServiceModalOpen(true)
            }}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '8px',
              gap: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              color: '#334155',
              boxShadow: 'var(--shadow-xs)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            title="Pivot or evolve service offering"
          >
            <ArrowRightLeft size={14} style={{ color: 'var(--primary)' }} />
            <span>Pivot Service</span>
          </button>

          {/* Delete Button - Icon Only */}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: '8px',
              color: '#dc2626',
              borderColor: '#fecaca',
              backgroundColor: '#fff5f5',
              boxShadow: 'var(--shadow-xs)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Delete this lead"
            aria-label="Delete this lead"
          >
            <Trash2 size={15} style={{ color: '#dc2626' }} />
          </button>

        </div>
      </div>

      {/* Interactive Visual Pipeline Progression Stepper */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xs)',
          marginBottom: '1.15rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
            <Layers size={14} style={{ color: 'var(--primary)' }} />
            <span>Pipeline Progression</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Click any stage to update lead status
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { key: 'New', label: 'New' },
            { key: 'Contacted', label: 'Contacted' },
            { key: 'Replied', label: 'Replied' },
            { key: 'Interested', label: 'Interested' },
            { key: 'Won', label: 'Won Deal' },
          ].map((st) => {
            const isCurrent = lead.stage === st.key
            return (
              <button
                key={st.key}
                onClick={() => handleStageSelect(st.key)}
                className="btn btn-sm"
                style={{
                  flex: '1 1 100px',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.775rem',
                  borderRadius: '8px',
                  backgroundColor: isCurrent ? 'var(--primary)' : '#f8fafc',
                  color: isCurrent ? '#ffffff' : '#475569',
                  border: isCurrent ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                  boxShadow: isCurrent ? '0 2px 6px rgba(79, 70, 229, 0.2)' : 'none',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                  fontWeight: isCurrent ? 700 : 500,
                }}
              >
                <span>{st.label}</span>
                {isCurrent && <Check size={13} />}
              </button>
            )
          })}

          {/* Quick chips for Lost and Opt-out */}
          <div style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto' }}>
            <button
              onClick={() => handleStageSelect('Lost')}
              className={`btn btn-sm ${lead.stage === 'Lost' ? 'btn-danger' : 'btn-ghost'}`}
              style={{
                fontSize: '0.75rem',
                padding: '0.4rem 0.65rem',
                borderRadius: '7px',
                color: lead.stage === 'Lost' ? '#ffffff' : '#ef4444',
                border: lead.stage === 'Lost' ? '1px solid transparent' : '1px solid #fecaca',
                backgroundColor: lead.stage === 'Lost' ? 'var(--danger)' : '#fff5f5',
                gap: '0.35rem',
              }}
              title="Mark as Lost"
            >
              <XCircle size={13} />
              <span>Lost</span>
              {lead.stage === 'Lost' && <Check size={12} />}
            </button>
            <button
              onClick={() => handleStageSelect('Do not contact')}
              className={`btn btn-sm ${lead.stage === 'Do not contact' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                fontSize: '0.75rem',
                padding: '0.4rem 0.65rem',
                borderRadius: '7px',
                color: '#64748b',
                gap: '0.35rem',
              }}
              title="Opt-out"
            >
              <Ban size={13} />
              <span>Opt-out</span>
              {lead.stage === 'Do not contact' && <Check size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* 2-Column Balanced Dashboard Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 370px) 1fr',
          gap: '1.15rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Account Details & Cadence Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Account Details Card */}
          <div className="card" style={{ padding: '1.15rem 1.35rem', borderRadius: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.85rem',
              }}
            >
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  margin: 0,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                Contact Details
              </h2>
              <button
                onClick={() => setEditModalOpen(true)}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '0.775rem',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  gap: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                title="Edit account details"
              >
                <Edit3 size={13} />
                <span>Edit</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Phone / WhatsApp Row */}
              {lead.phone ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0',
                    borderBottom: '1px solid #f1f5f9',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    onClick={() => handleOpenComposer('WhatsApp')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      minWidth: 0,
                      cursor: 'pointer',
                      flex: 1,
                    }}
                    title="Click to suggest WhatsApp template"
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        backgroundColor: '#eef2ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Phone size={15} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Phone / WhatsApp
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.phone}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenComposer('WhatsApp')}
                      className="btn btn-whatsapp btn-sm"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px', gap: '4px', cursor: 'pointer' }}
                      title="Suggest template & chat on WhatsApp"
                    >
                      <MessageCircle size={13} />
                      <span>WhatsApp</span>
                    </button>
                    <a
                      href={`tel:${lead.phone}`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px', gap: '4px' }}
                      title="Call"
                    >
                      <Phone size={13} />
                      <span>Call</span>
                    </a>
                  </div>
                </div>
              ) : null}

              {/* Email Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  gap: '0.75rem',
                }}
              >
                <div
                  onClick={() => lead.email && handleOpenComposer('Email')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    minWidth: 0,
                    cursor: lead.email ? 'pointer' : 'default',
                    flex: 1,
                  }}
                  title={lead.email ? 'Click to suggest Email template' : undefined}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      backgroundColor: '#eef2ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Mail size={15} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
                      Email Address
                    </span>
                    <span style={{ fontSize: '0.85rem', color: lead.email ? '#0f172a' : '#94a3b8', fontWeight: lead.email ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.email || 'No email registered'}
                    </span>
                  </div>
                </div>

                {lead.email && (
                  <div style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenComposer('Email')}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', gap: '4px', cursor: 'pointer' }}
                      title="Suggest template & send email"
                    >
                      <Mail size={13} />
                      <span>Email</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Instagram Row */}
              {lead.instagram_handle && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0',
                    borderBottom: '1px solid #f1f5f9',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    onClick={() => handleOpenComposer('Instagram')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      minWidth: 0,
                      cursor: 'pointer',
                      flex: 1,
                    }}
                    title="Click to suggest Instagram DM template"
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        backgroundColor: '#fdf2f8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <InstagramIcon size={15} style={{ color: '#db2777' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Instagram
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{lead.instagram_handle}
                      </span>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenComposer('Instagram')}
                      className="btn btn-instagram btn-sm"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px', gap: '4px', cursor: 'pointer' }}
                      title="Suggest template & open Instagram DM"
                    >
                      <InstagramIcon size={13} />
                      <span>DM</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Channel and Next Action combined info */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em', display: 'block' }}>
                    Primary Channel
                  </span>
                  <span className={`badge badge-channel-${lead.channel}`} style={{ fontSize: '0.72rem', padding: 0, marginTop: '3px' }}>
                    {lead.channel}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em', display: 'block' }}>
                    Next Scheduled Action
                  </span>
                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: lead.next_follow_up ? '#0f172a' : '#64748b', marginTop: '3px', display: 'block' }}>
                    {lead.next_follow_up ? formatDate(lead.next_follow_up) : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cadence Outreach Action Card */}
          <div className="card" style={{ padding: '1.15rem 1.35rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={15} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Cadence Outreach
                </h2>
              </div>
              <span className={`badge badge-stage-${lead.stage.replace(/\s+/g, '')}`} style={{ fontSize: '0.72rem', padding: 0 }}>
                {lead.stage}
              </span>
            </div>

            {/* Active Cadence Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setSendFollowupModalOpen(true)}
                className="btn btn-primary btn-sm"
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <Send size={15} />
                <span>Choose Template & Send Follow-up</span>
              </button>

              {(lead.stage === 'New' || lead.stage === 'Contacted') ? (
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '7px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Clock size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>
                    Current: <strong>Step {lead.follow_up_count}/3</strong> • Due:{' '}
                    <strong>{formatDate(lead.next_follow_up)}</strong>
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.785rem',
                    backgroundColor:
                      lead.stage === 'Won'
                        ? '#ecfdf5'
                        : lead.stage === 'Replied'
                        ? '#f5f3ff'
                        : lead.stage === 'Interested'
                        ? '#fff7ed'
                        : '#f8fafc',
                    border: `1px solid ${
                      lead.stage === 'Won'
                        ? '#a7f3d0'
                        : lead.stage === 'Replied'
                        ? '#ddd6fe'
                        : lead.stage === 'Interested'
                        ? '#fed7aa'
                        : '#e2e8f0'
                    }`,
                    color:
                      lead.stage === 'Won'
                        ? '#065f46'
                        : lead.stage === 'Replied'
                        ? '#6d28d9'
                        : lead.stage === 'Interested'
                        ? '#c2410c'
                        : '#64748b',
                  }}
                >
                  {lead.stage === 'Won' && 'Deal Won! 30-day upsell review task scheduled.'}
                  {lead.stage === 'Replied' && `Lead replied via ${lead.channel}. Outreach cadence is paused.`}
                  {lead.stage === 'Interested' && `High interest lead. Follow-up reminder active.`}
                  {lead.stage === 'Lost' && 'Lead marked as lost. Cadence is inactive.'}
                  {lead.stage === 'Do not contact' && 'Opt-out active. Outreach suppressed.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction Form & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Add Activity Note Form */}
          <div className="card" style={{ padding: '1.15rem 1.35rem', borderRadius: '12px' }}>
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                marginBottom: '0.2rem',
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              Log Interaction Note
            </h2>
            <p
              className="text-muted"
              style={{ fontSize: '0.8rem', marginBottom: '0.85rem' }}
            >
              Record call takeaways, client feedback, or proposal requirements.
            </p>
            <form onSubmit={handleAddNote} className="flex gap-2.5 items-center" noValidate>
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type note or call summary..."
                className="input-field"
                style={{
                  flex: 1,
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.825rem',
                  borderRadius: '8px',
                }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                style={{
                  padding: '0.5rem 1rem',
                  gap: '6px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                }}
              >
                <Plus size={14} />
                <span>Log Note</span>
              </button>
            </form>
          </div>

          {/* Activity Log Timeline */}
          <div className="card" style={{ flex: 1, padding: '1.15rem 1.35rem', borderRadius: '12px' }}>
            <div className="flex justify-between items-center mb-4">
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  margin: 0,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                Activity Timeline
              </h2>
              <span
                className="badge badge-neutral"
                style={{ fontSize: '0.72rem', padding: 0 }}
              >
                {activities.length} {activities.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            {activities.length === 0 ? (
              <p className="text-muted" style={{ margin: 0, padding: '1.5rem 0' }}>
                No interactions logged yet for this lead.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="timeline-item"
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      paddingBottom: '1.5rem',
                      position: 'relative',
                    }}
                  >
                    <div
                      className="timeline-icon"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {activity.action_type === 'sent' && (
                        <Send size={15} style={{ color: 'var(--primary)' }} />
                      )}
                      {activity.action_type === 'received' && (
                        <UserCheck size={15} style={{ color: '#a259ff' }} />
                      )}
                      {activity.action_type === 'note' && (
                        <Activity size={15} style={{ color: '#ff9900' }} />
                      )}
                      {activity.action_type === 'system' && (
                        <Clock size={15} style={{ color: 'var(--muted)' }} />
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className="font-semibold capitalize"
                          style={{ fontSize: '0.925rem', color: '#0f172a' }}
                        >
                          {activity.action_type === 'sent' && 'Outreach Message Sent'}
                          {activity.action_type === 'received' && 'Incoming Reply Received'}
                          {activity.action_type === 'note' && 'Staff Note / Milestone'}
                          {activity.action_type === 'system' && 'Automated Workflow Action'}
                        </span>
                        <span
                          className="text-muted"
                          style={{ fontSize: '0.775rem' }}
                          suppressHydrationWarning
                        >
                          {formatDateTime(activity.created_at)}
                        </span>
                      </div>
                      <p
                        className="text-muted"
                        style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          color: '#475569',
                          lineHeight: 1.6,
                        }}
                      >
                        {activity.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Channel Reply Source Selection Modal */}
      {hasMultipleChannels && (
        <ReplyChannelModal
          isOpen={replyModalOpen}
          onClose={() => setReplyModalOpen(false)}
          onConfirm={(selectedChannel, note) => {
            handleAction(replyModalAction, note, selectedChannel)
          }}
          lead={lead}
          actionType={replyModalAction}
        />
      )}

      {/* Edit Lead Modal */}
      <EditLeadModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        lead={lead}
        onSave={async (updatedLead) => {
          setLead(updatedLead)
          try {
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()
            const { data: refreshedActs } = await supabase
              .from('activity_log')
              .select('*')
              .eq('lead_id', lead.id)
              .order('created_at', { ascending: false })
            if (refreshedActs) setActivities(refreshedActs)
          } catch {
            // fallback
          }
          showToast('Lead details updated successfully!')
        }}
      />

      {/* Interactive Send Followup / Reply Modal */}
      {lead && (
        <SendFollowupModal
          isOpen={sendFollowupModalOpen}
          onClose={() => setSendFollowupModalOpen(false)}
          lead={lead}
          initialChannel={selectedComposerChannel}
          onSentSuccess={async ({ channel, templateName }) => {
            showToast(`Outreach sent via ${channel} using ${templateName}`)
            try {
              const { createClient } = await import('@/lib/supabase/client')
              const supabase = createClient()
              const { data: refreshedLead } = await supabase
                .from('leads')
                .select('*')
                .eq('id', lead.id)
                .single()
              if (refreshedLead) setLead(refreshedLead as ExtendedLead)
              const { data: refreshedActs } = await supabase
                .from('activity_log')
                .select('*')
                .eq('lead_id', lead.id)
                .order('created_at', { ascending: false })
              if (refreshedActs) setActivities(refreshedActs)
            } catch {
              // fallback
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {lead && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => !isDeleting && setDeleteConfirmOpen(false)}
          onConfirm={handleDeleteLead}
          title="Delete Lead"
          message={`Are you sure you want to delete "${lead.business_name}"? This action cannot be undone and will permanently remove this lead, their scheduled tasks, and activity logs.`}
          confirmText={isDeleting ? 'Deleting...' : 'Delete Lead'}
          cancelText="Cancel"
          variant="danger"
        />
      )}

      {/* Service Offering & Pivot Modal */}
      {lead && (
        <ChangeServiceModal
          leadId={lead.id}
          businessName={lead.business_name}
          currentService={lead.current_service}
          initialService={lead.initial_service}
          agreedService={lead.agreed_service}
          serviceNotes={lead.service_notes}
          serviceHistory={serviceHistory}
          pivotChain={pivotChain}
          currentStage={lead.stage}
          isOpen={changeServiceModalOpen}
          initialTab={changeServiceModalTab}
          onClose={() => setChangeServiceModalOpen(false)}
          onSuccess={handleServicePivotSuccess}
        />
      )}
    </div>
  )
}
