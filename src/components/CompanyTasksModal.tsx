'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  X,
  Building2,
  Clock,
  Send,
  ExternalLink,
  Copy,
  Check,
  FileText,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import type { ExtendedTask, ExtendedLead, ChannelType } from '@/types/database'
import { formatDate, isExactToday } from '@/lib/dateUtils'
import { ServiceBadge } from '@/components/ServiceBadge'

export interface CompanyTasksModalProps {
  isOpen: boolean
  companyName: string
  tasks: ExtendedTask[]
  leads: ExtendedLead[]
  onClose: () => void
  onActionTask: (task: ExtendedTask, lead: ExtendedLead) => void
}

export function CompanyTasksModal({
  isOpen,
  companyName,
  tasks = [],
  leads = [],
  onClose,
  onActionTask,
}: CompanyTasksModalProps) {
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const handleCopy = (taskId: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedTaskId(taskId)
    setTimeout(() => setCopiedTaskId(null), 2500)
  }

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          color: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid #bfdbfe',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {companyName}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} due today or requiring immediate action
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.35rem', borderRadius: '8px', color: '#94a3b8' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Tasks List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {tasks.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <Check size={28} style={{ color: '#16a34a', margin: '0 auto 0.5rem' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No tasks due today for {companyName}!</p>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>All scheduled outreach is up to date.</span>
            </div>
          ) : (
            tasks.map((task, idx) => {
              // Identify the associated lead
              const matchedLead =
                leads.find((l) => l.id === task.lead_id) ||
                (task.leads
                  ? ({
                      id: task.lead_id || '',
                      business_name: task.leads.business_name,
                      channel: task.leads.channel,
                      lead_code: task.leads.lead_code,
                      stage: task.leads.stage,
                    } as ExtendedLead)
                  : null)

              const isOverdue = !isExactToday(task.due_date)
              const leadCode = matchedLead?.lead_code || `Lead #${idx + 1}`
              const leadChannel = matchedLead?.channel || task.channel || 'Email'
              const leadService = matchedLead?.current_service || matchedLead?.initial_service || 'Website Services'

              return (
                <div
                  key={task.id || idx}
                  style={{
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    padding: '1rem 1.15rem',
                    boxShadow: 'var(--shadow-xs)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    position: 'relative',
                  }}
                >
                  {/* Task Header: Title & Due Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                        {task.title}
                      </span>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: isOverdue ? '#fef2f2' : '#fffbeb',
                        color: isOverdue ? '#dc2626' : '#b45309',
                        border: isOverdue ? '1px solid #fecaca' : '1px solid #fde68a',
                      }}
                    >
                      <Clock size={11} />
                      <span>{isOverdue ? `Overdue (${formatDate(task.due_date)})` : 'Due Today'}</span>
                    </span>
                  </div>

                  {/* Highlighted Lead Context Box (Crucial user requirement: highlight which lead has this task) */}
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Assigned Lead:</span>
                        <Link
                          href={`/leads/detail?id=${matchedLead?.id || task.lead_id}`}
                          onClick={onClose}
                          style={{
                            fontWeight: 800,
                            color: '#1d4ed8',
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            textDecoration: 'none',
                          }}
                          title="Open lead overview"
                        >
                          <span>{leadCode}</span>
                          <ExternalLink size={11} />
                        </Link>
                      </div>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          fontWeight: 600,
                          color: '#334155',
                        }}
                      >
                        {leadChannel}
                      </span>

                      <ServiceBadge service={leadService} size="sm" />
                    </div>

                    {matchedLead?.stage && (
                      <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                        Stage: <strong>{matchedLead.stage}</strong>
                      </span>
                    )}
                  </div>

                  {/* Template Message preview if description is available */}
                  {task.description && (
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={12} />
                          <span>Outreach Message</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(task.id, task.description || '')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            backgroundColor: copiedTaskId === task.id ? '#ecfdf5' : '#ffffff',
                            color: copiedTaskId === task.id ? '#16a34a' : 'var(--primary)',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          {copiedTaskId === task.id ? (
                            <>
                              <Check size={11} />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p style={{ margin: 0, color: '#334155', lineHeight: 1.45, whiteSpace: 'pre-wrap', maxHeight: '70px', overflowY: 'auto' }}>
                        {task.description}
                      </p>
                    </div>
                  )}

                  {/* Action Button Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.25rem' }}>
                    <Link
                      href={`/leads/detail?id=${matchedLead?.id || task.lead_id}`}
                      onClick={onClose}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.785rem', borderRadius: '6px' }}
                    >
                      View Profile
                    </Link>
                    {matchedLead && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          onActionTask(task, matchedLead)
                        }}
                        className="btn btn-primary btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '0.35rem 0.85rem',
                          fontSize: '0.785rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}
                      >
                        <Send size={13} />
                        <span>Action & Send Outreach</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pinned Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.45rem 1rem' }}
          >
            Close
          </button>
          <Link
            href={`/company?name=${encodeURIComponent(companyName)}`}
            onClick={onClose}
            className="btn btn-primary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 1.15rem',
              fontWeight: 600,
            }}
          >
            <span>Open Company Workspace</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
