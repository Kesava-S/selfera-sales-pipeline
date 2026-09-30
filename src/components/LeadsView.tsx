'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  PlusCircle,
  Search,
  Upload,
  MessageCircle,
  Mail,
  Phone,
  ArrowRight,
  Filter,
  Calendar,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { InstagramIcon } from '@/components/Icons'
import { useAddLeadModal } from '@/components/AddLeadModalProvider'
import type { ExtendedLead } from '@/types/database'
import { formatDate } from '@/lib/dateUtils'
import { ConfirmModal } from '@/components/ConfirmModal'
import { getLeadCadenceStep, CADENCE_STEPS } from '@/lib/templateUtils'
import { ServiceBadge } from '@/components/ServiceBadge'

interface LeadsViewProps {
  initialLeads?: ExtendedLead[] | null
}

export function LeadsView({ initialLeads = [] }: LeadsViewProps) {
  const [leads, setLeads] = useState<ExtendedLead[]>(initialLeads || [])
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<ExtendedLead | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const searchParams = useSearchParams()
  const { openAddLeadModal } = useAddLeadModal()

  const fetchLeads = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) {
        setLeads(data as ExtendedLead[])
      }
    } catch {
      // fallback
    }
  }, [])

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
      setDeleteTarget(null)
      setIsDeleting(false)
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError('Failed to delete lead', err, 'LeadsView.handleDeleteLead', { leadId: deleteTarget.id })
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  useEffect(() => {
    if (initialLeads) {
      setLeads(initialLeads)
    }
  }, [initialLeads])

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      const defaultCompany = searchParams.get('company')
        ? decodeURIComponent(searchParams.get('company')!)
        : ''
      openAddLeadModal({
        defaultCompany,
        onSuccess: () => {
          fetchLeads()
        },
      })
    }
  }, [searchParams, openAddLeadModal, fetchLeads])

  const todayStr = new Date().toISOString().split('T')[0]

  // Metric counts
  const totalLeads = leads.length
  const contactedLeads = leads.filter((l) => l.stage === 'Contacted').length
  const repliedInterested = leads.filter((l) => l.stage === 'Replied' || l.stage === 'Interested').length
  const wonLeads = leads.filter((l) => l.stage === 'Won').length
  const dueToday = leads.filter((l) => l.next_follow_up && l.next_follow_up <= todayStr && !['Replied', 'Won', 'Lost', 'Do not contact'].includes(l.stage)).length

  // Filtered list
  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch =
      lead.business_name.toLowerCase().includes(query) ||
      (lead.email && lead.email.toLowerCase().includes(query)) ||
      (lead.phone && lead.phone.toLowerCase().includes(query)) ||
      (lead.instagram_handle && lead.instagram_handle.toLowerCase().includes(query))

    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter
    const matchesChannel = channelFilter === 'all' || lead.channel === channelFilter
    const matchesService =
      serviceFilter === 'all'
        ? true
        : serviceFilter === 'pivoted'
        ? Boolean(lead.initial_service && lead.current_service && lead.initial_service !== lead.current_service)
        : (lead.current_service || lead.initial_service || 'Website Services') === serviceFilter

    return matchesSearch && matchesStage && matchesChannel && matchesService
  })

  const getChannelBadgeClass = (channel: string) => {
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

  const getChannelIcon = (channel: string) => {
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
            All Pipeline Leads
          </h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Manage commercial accounts, monitor cadence progress, and track conversion stages.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/leads/import" className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', borderRadius: '8px', gap: '6px' }}>
            <Upload size={14} />
            <span>Bulk CSV Import</span>
          </Link>
          <button
            type="button"
            onClick={() => openAddLeadModal({ onSuccess: () => { fetchLeads() } })}
            className="btn btn-primary btn-sm"
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.8125rem', borderRadius: '8px', gap: '6px' }}
          >
            <PlusCircle size={14} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stat-grid" style={{ gap: '0.75rem', marginBottom: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Total Pipeline</span>
          <span className="stat-value" style={{ fontSize: '1.45rem' }}>{totalLeads}</span>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>In Active Outreach</span>
          <span className="stat-value" style={{ fontSize: '1.45rem', color: 'var(--primary)' }}>
            {contactedLeads}
          </span>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Replied / Interested</span>
          <span className="stat-value" style={{ fontSize: '1.45rem', color: '#a259ff' }}>
            {repliedInterested}
          </span>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Deals Won</span>
          <span className="stat-value" style={{ fontSize: '1.45rem', color: 'var(--success)' }}>
            {wonLeads}
          </span>
        </div>
        <div className="stat-card" style={{ padding: '0.8rem 1rem', borderRadius: '12px', gap: '0.25rem' }}>
          <span className="stat-label" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>Follow-ups Due Today</span>
          <span className="stat-value" style={{ fontSize: '1.45rem', color: dueToday > 0 ? 'var(--warning)' : 'var(--muted)' }}>
            {dueToday}
          </span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '10px',
        }}
      >
        <div className="flex items-center gap-3" style={{ flex: '1 1 320px' }}>
          <Search size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by company name, email, phone or handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ border: 'none', padding: '0.2rem 0', boxShadow: 'none', backgroundColor: 'transparent', fontSize: '0.9rem' }}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Stage Filter */}
          <div className="flex items-center gap-2">
            <Filter size={15} style={{ color: '#94a3b8' }} />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="input-field"
              style={{ padding: '0.5rem 0.95rem', width: 'auto', fontSize: '0.85rem', borderRadius: '8px' }}
            >
              <option value="all">All Stages</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Replied">Replied</option>
              <option value="Interested">Interested</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="Do not contact">Do not contact</option>
            </select>
          </div>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="input-field"
            style={{ padding: '0.5rem 0.95rem', width: 'auto', fontSize: '0.85rem', borderRadius: '8px' }}
          >
            <option value="all">All Channels</option>
            <option value="Email">Email</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
            <option value="Phone">Phone</option>
            <option value="Walk-in">Walk-in</option>
          </select>

          {/* Service Offering Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="input-field"
            style={{ padding: '0.5rem 0.95rem', width: 'auto', fontSize: '0.85rem', borderRadius: '8px' }}
            title="Filter by pitched or active service"
          >
            <option value="all">All Services</option>
            <option value="Website Services">Website Services</option>
            <option value="Dashboard Services">Dashboard Services</option>
            <option value="Micro Services">Micro Services</option>
            <option value="End to End Automation">End to End Automation</option>
            <option value="Cold Outreach">Cold Outreach</option>
            <option value="pivoted">Pivoted Services Only</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Business Name</th>
              <th>Service Pitch</th>
              <th>Channel</th>
              <th>Stage</th>
              <th>Cadence Step</th>
              <th>Next Action</th>
              <th style={{ width: '48px', textAlign: 'right', paddingRight: '1.25rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted" style={{ padding: '3rem' }}>
                  No leads found matching current search and filter criteria.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const isDueToday =
                  lead.next_follow_up &&
                  lead.next_follow_up <= todayStr &&
                  !['Replied', 'Won', 'Lost', 'Do not contact'].includes(lead.stage)
                const leadStep = getLeadCadenceStep(lead)
                const stepInfo = CADENCE_STEPS[leadStep]
                const isCadenceHalted = ['Won', 'Lost', 'Do not contact'].includes(lead.stage)

                return (
                  <tr key={lead.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/leads/detail?id=${lead.id}`}
                          style={{ fontWeight: 600, color: 'var(--foreground)' }}
                        >
                          {lead.business_name}
                        </Link>
                        {lead.lead_code && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#64748b',
                              backgroundColor: '#f1f5f9',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {lead.lead_code}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Service Pitch Column */}
                    <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <ServiceBadge
                        service={lead.current_service || lead.initial_service || 'Website Services'}
                        size="sm"
                      />
                    </td>

                    <td>
                      <span className={`badge ${getChannelBadgeClass(lead.channel)}`}>
                        {getChannelIcon(lead.channel)}
                        <span style={{ marginLeft: '4px' }}>{lead.channel}</span>
                      </span>
                    </td>

                    <td>
                      <span className={`badge badge-stage-${lead.stage.replace(/\s+/g, '')}`}>
                        {lead.stage}
                      </span>
                    </td>

                    <td>
                      {isCadenceHalted ? (
                        <span style={{ fontSize: '0.785rem', color: '#64748b' }}>
                          Cadence Closed
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a' }}>
                            {stepInfo.shortLabel}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 500 }}>
                            {stepInfo.timing}
                          </span>
                        </div>
                      )}
                    </td>

                    <td>
                      {lead.next_follow_up ? (
                        <div
                          className="flex items-center gap-1.5"
                          style={{
                            color: isDueToday ? 'var(--warning)' : 'var(--muted)',
                            fontWeight: isDueToday ? 600 : 400,
                          }}
                        >
                          <Calendar size={14} />
                          <span suppressHydrationWarning>{formatDate(lead.next_follow_up)}</span>
                          {isDueToday && <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: 0, fontWeight: 700 }}>Due</span>}
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(lead)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          title={`Delete ${lead.business_name}`}
                          aria-label={`Delete ${lead.business_name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                        <Link
                          href={`/leads/detail?id=${lead.id}`}
                          className="lead-row-arrow"
                          title={`View ${lead.business_name} details`}
                          aria-label={`View ${lead.business_name} details`}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
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
    </div>
  )
}
