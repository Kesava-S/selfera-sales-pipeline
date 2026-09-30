'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRightLeft, Check, AlertCircle, Layers, Clock, FileText, CheckCircle2 } from 'lucide-react'
import { ALL_SERVICES, ServiceType, LeadServiceHistory } from '@/types/database'
import { recordServicePivot, getServiceMeta, formatComboServices, parseComboServices } from '@/lib/serviceUtils'
import { ServiceBadge, ServiceIcon } from '@/components/ServiceBadge'
import { formatDateTime } from '@/lib/dateUtils'

export interface ChangeServiceModalProps {
  leadId: string
  businessName: string
  currentService?: string | null
  initialService?: string | null
  agreedService?: string | null
  serviceNotes?: string | null
  serviceHistory?: LeadServiceHistory[]
  pivotChain?: string[]
  currentStage: string
  isOpen: boolean
  initialTab?: 'offering' | 'pivot'
  onClose: () => void
  onSuccess: () => void
}

const COMMON_REASONS = [
  'Client requested custom dashboard during call',
  'Client already has a modern website, needs automation',
  'Client requested combo bundle (Dashboard + Automation)',
  'Client interested in multi-channel cold outreach campaign',
  'Operations team requested dedicated micro-service API',
  'Client requested full digital overhaul (Website + Dashboard)',
]

export function ChangeServiceModal({
  leadId,
  businessName,
  currentService = 'Website Services',
  initialService = 'Website Services',
  agreedService,
  serviceNotes,
  serviceHistory = [],
  pivotChain = [],
  currentStage,
  isOpen,
  initialTab = 'offering',
  onClose,
  onSuccess,
}: ChangeServiceModalProps) {
  const activeService = currentService || 'Website Services'
  const [activeTab, setActiveTab] = useState<'offering' | 'pivot'>(initialTab)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Form states for Pivot
  const [mode, setMode] = useState<'single' | 'combo'>('single')
  const [selectedSingleService, setSelectedSingleService] = useState<ServiceType>(
    (ALL_SERVICES.find((s) => s !== activeService) || 'Dashboard Services') as ServiceType
  )
  const [selectedComboServices, setSelectedComboServices] = useState<string[]>([
    'Dashboard Services',
    'End to End Automation',
  ])

  const selectedTargetService =
    mode === 'single'
      ? selectedSingleService
      : formatComboServices(selectedComboServices)

  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<{ reason?: string; combo?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const toggleComboService = (srv: string) => {
    if (fieldErrors.combo) setFieldErrors((prev) => ({ ...prev, combo: undefined }))
    setSelectedComboServices((prev) => {
      if (prev.includes(srv)) {
        if (prev.length <= 1) return prev // keep at least 1
        return prev.filter((s) => s !== srv)
      }
      return [...prev, srv]
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { reason?: string; combo?: string } = {}
    if (!reason.trim()) {
      newErrors.reason = 'Please enter or select a reason for changing the service.'
    }

    if (mode === 'combo' && selectedComboServices.length < 2) {
      newErrors.combo = 'Please select at least 2 services to form a Combo Package.'
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    setFieldErrors({})
    setIsSubmitting(true)
    setErrorMsg(null)

    const result = await recordServicePivot({
      leadId,
      businessName,
      fromService: activeService,
      toService: selectedTargetService,
      currentStage,
      reason: reason.trim(),
      additionalNotes: notes.trim() || undefined,
    })

    setIsSubmitting(false)

    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setErrorMsg(result.error || 'Failed to update service. Please try again.')
    }
  }

  const activeComboItems = parseComboServices(activeService)

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
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
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
                width: 36,
                height: 36,
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Service Offering & Evolution
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.785rem', color: '#64748b' }}>
                {businessName} • Lead Service Management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.35rem', borderRadius: '8px', color: '#94a3b8' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pinned Tab Navigation */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '0 1.5rem',
            gap: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('offering')}
            style={{
              padding: '0.75rem 0.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'offering' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'offering' ? 'var(--primary)' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={14} />
            <span>Service Offering</span>
            {serviceHistory.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'offering' ? '#eff6ff' : '#e2e8f0',
                  color: activeTab === 'offering' ? 'var(--primary)' : '#475569',
                  fontWeight: 700,
                }}
              >
                {serviceHistory.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pivot')}
            style={{
              padding: '0.75rem 0.25rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'pivot' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'pivot' ? 'var(--primary)' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowRightLeft size={14} />
            <span>Pivot Service</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent',
          }}
        >
          {/* TAB 1: SERVICE OFFERING & EVOLUTION VIEW */}
          {activeTab === 'offering' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Active Proposition & Chain */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#64748b',
                    fontWeight: 700,
                    marginBottom: '0.4rem',
                  }}
                >
                  Active Service Proposition & Evolution Path
                </div>
                <ServiceBadge
                  service={activeService}
                  initialService={initialService}
                  chain={pivotChain.length > 0 ? pivotChain : [initialService || 'Website Services', activeService]}
                  showPivot={true}
                  size="md"
                />
              </div>

              {/* Combo Bundle Breakdown (If combo) */}
              {activeComboItems.length > 1 && (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#64748b',
                      fontWeight: 700,
                      marginBottom: '0.4rem',
                    }}
                  >
                    Combo Bundle Components ({activeComboItems.length} Services)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {activeComboItems.map((item) => {
                      const meta = getServiceMeta(item)
                      return (
                        <div
                          key={item}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #f1f5f9',
                            backgroundColor: '#f8fafc',
                          }}
                        >
                          <ServiceIcon service={item} size={15} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: meta.color }}>
                            {item}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Agreed Contract Status */}
              {agreedService && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#166534',
                      fontWeight: 700,
                      marginBottom: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Agreed / Won Contract Service</span>
                  </div>
                  <ServiceBadge service={agreedService} size="md" />
                </div>
              )}

              {/* Scope Notes */}
              {serviceNotes && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#64748b',
                      fontWeight: 700,
                      marginBottom: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <FileText size={13} />
                    <span>Scope & Operational Notes</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.825rem', color: '#334155', lineHeight: 1.5 }}>
                    {serviceNotes}
                  </p>
                </div>
              )}

              {/* Complete Service Evolution Timeline */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowRightLeft size={14} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a' }}>
                      Evolution Audit Trail ({serviceHistory.length} {serviceHistory.length === 1 ? 'pivot' : 'pivots'})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Stage: <strong>{currentStage}</strong>
                  </span>
                </div>

                {serviceHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {serviceHistory.map((hist, idx) => (
                      <div
                        key={hist.id || idx}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.75rem' }}>
                            Pivot #{idx + 1}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.72rem' }}>
                            <Clock size={11} />
                            <span>{formatDateTime(hist.created_at)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: '#1e293b' }}>
                          <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{hist.from_service}</span>
                          <span style={{ color: '#64748b' }}>→</span>
                          <strong style={{ color: '#0f172a' }}>{hist.to_service}</strong>
                        </div>

                        {hist.reason && (
                          <div style={{ marginTop: '0.35rem', color: '#475569', fontSize: '0.75rem', fontStyle: 'italic', backgroundColor: '#ffffff', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                            &ldquo;{hist.reason}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                    Initial proposition <strong>{activeService}</strong> registered. No service changes recorded yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PIVOT SERVICE FORM */}
          {activeTab === 'pivot' && (
            <form id="pivot-service-form" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {errorMsg && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '0.825rem',
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Current Active Service Status */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 700 }}>
                    Current Active Offering
                  </div>
                  <div style={{ marginTop: '0.2rem' }}>
                    <ServiceBadge service={activeService} size="sm" />
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                  Pipeline Stage: <strong style={{ color: '#0f172a' }}>{currentStage}</strong>
                </div>
              </div>

              {/* Mode Switcher: Single Service vs Combo Package */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Offering Structure
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    backgroundColor: '#f1f5f9',
                    padding: '4px',
                    borderRadius: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMode('single')
                      if (fieldErrors.combo) setFieldErrors((prev) => ({ ...prev, combo: undefined }))
                    }}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: mode === 'single' ? '#ffffff' : 'transparent',
                      color: mode === 'single' ? '#0f172a' : '#64748b',
                      boxShadow: mode === 'single' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Single Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('combo')}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: mode === 'combo' ? '#ffffff' : 'transparent',
                      color: mode === 'combo' ? '#0f172a' : '#64748b',
                      boxShadow: mode === 'combo' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Combo Package (Bundle)
                  </button>
                </div>
              </div>

              {/* Target Service Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  {mode === 'single' ? 'Select New Service' : 'Select Bundled Services (Choose 2 or more)'}
                </label>

                {mode === 'single' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.45rem' }}>
                    {ALL_SERVICES.map((srv) => {
                      const isSelected = selectedSingleService === srv
                      const isCurrent = activeService === srv
                      const meta = getServiceMeta(srv)

                      return (
                        <div
                          key={srv}
                          onClick={() => setSelectedSingleService(srv)}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: '8px',
                            border: isSelected ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                            backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <ServiceIcon service={srv} size={15} />
                            <div>
                              <div style={{ fontSize: '0.825rem', fontWeight: 600, color: isSelected ? 'var(--primary)' : '#0f172a' }}>
                                {srv}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {meta.description}
                              </div>
                            </div>
                          </div>

                          {isCurrent && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9' }}>
                              Current
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {ALL_SERVICES.map((srv) => {
                      const isChecked = selectedComboServices.includes(srv)

                      return (
                        <div
                          key={srv}
                          onClick={() => toggleComboService(srv)}
                          style={{
                            padding: '0.6rem 0.85rem',
                            borderRadius: '8px',
                            border: isChecked ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                            backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            <ServiceIcon service={srv} size={15} />
                            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: isChecked ? 'var(--primary)' : '#0f172a' }}>
                              {srv}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {fieldErrors.combo && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          color: '#dc2626',
                          fontSize: '0.785rem',
                          marginTop: '0.25rem',
                          fontWeight: 500,
                        }}
                      >
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span>{fieldErrors.combo}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pivot Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Reason for Pivot <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    if (fieldErrors.reason) setFieldErrors((prev) => ({ ...prev, reason: undefined }))
                  }}
                  placeholder="e.g. Client requested custom dashboard during call"
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    fontSize: '0.825rem',
                    borderRadius: '8px',
                    border: fieldErrors.reason ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                    outline: 'none',
                    backgroundColor: fieldErrors.reason ? '#fef2f2' : '#ffffff',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                />

                {fieldErrors.reason && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      color: '#dc2626',
                      fontSize: '0.785rem',
                      marginTop: '0.35rem',
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.reason}</span>
                  </div>
                )}

                {/* Quick Select Reasons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                  {COMMON_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setReason(r)
                        if (fieldErrors.reason) setFieldErrors((prev) => ({ ...prev, reason: undefined }))
                      }}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        backgroundColor: reason === r ? '#eff6ff' : '#ffffff',
                        color: reason === r ? 'var(--primary)' : '#475569',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope / Transition Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Scope & Agreement Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional scope requirements or notes from conversation..."
                  rows={2}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    fontSize: '0.825rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            </form>
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
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          {activeTab === 'offering' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.45rem 1rem' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pivot')}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1.15rem' }}
              >
                <ArrowRightLeft size={14} />
                <span>Pivot to New Service</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.45rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="pivot-service-form"
                disabled={isSubmitting || selectedTargetService === activeService}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1.15rem' }}
              >
                {isSubmitting ? (
                  'Recording...'
                ) : (
                  <>
                    <Check size={15} />
                    <span>Confirm Service Pivot</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
