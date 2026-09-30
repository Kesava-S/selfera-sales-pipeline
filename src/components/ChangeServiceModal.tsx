'use client'

import React, { useState } from 'react'
import { X, ArrowRightLeft, Check, AlertCircle } from 'lucide-react'
import { ALL_SERVICES, ServiceType } from '@/types/database'
import { recordServicePivot } from '@/lib/serviceUtils'
import { ServiceBadge, ServiceIcon } from '@/components/ServiceBadge'
import { getServiceMeta } from '@/lib/serviceUtils'

interface ChangeServiceModalProps {
  leadId: string
  businessName: string
  currentService?: string | null
  initialService?: string | null
  currentStage: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const COMMON_REASONS = [
  'Client requested custom dashboard during call',
  'Client already has a modern website, needs automation',
  'Client interested in multi-channel cold outreach campaign',
  'Operations team requested dedicated micro-service API',
  'Client requested bundled website + dashboard',
]

export function ChangeServiceModal({
  leadId,
  businessName,
  currentService = 'Website Services',
  initialService = 'Website Services',
  currentStage,
  isOpen,
  onClose,
  onSuccess,
}: ChangeServiceModalProps) {
  const activeService = (currentService || 'Website Services') as ServiceType
  const [selectedService, setSelectedService] = useState<ServiceType>(
    ALL_SERVICES.find((s) => s !== activeService) || 'Dashboard Services'
  )
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const targetMeta = getServiceMeta(selectedService)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setErrorMsg('Please specify why the service is changing.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    const result = await recordServicePivot({
      leadId,
      businessName,
      fromService: activeService,
      toService: selectedService,
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

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary-light)',
              }}
            >
              <ArrowRightLeft size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                Service Pivot & Evolution
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {businessName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '0.375rem', borderRadius: 'var(--radius-md)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.8125rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current vs Target Service Indicator */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                Current Service
              </div>
              <ServiceBadge service={activeService} size="md" />
            </div>

            <ArrowRightLeft size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />

            <div>
              <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                New Target Service
              </div>
              <ServiceBadge service={selectedService} size="md" />
            </div>
          </div>

          {/* Select Target Service Grid */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Select New Service Offering
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '0.5rem' }}>
              {ALL_SERVICES.map((srv) => {
                const meta = getServiceMeta(srv)
                const isSelected = selectedService === srv
                const isCurrent = activeService === srv

                return (
                  <button
                    key={srv}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setSelectedService(srv)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected
                        ? '1px solid var(--color-primary-light)'
                        : '1px solid var(--color-border)',
                      backgroundColor: isSelected
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'var(--color-surface)',
                      opacity: isCurrent ? 0.45 : 1,
                      cursor: isCurrent ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <ServiceIcon name={meta.iconName} size={16} color={meta.color} />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: isSelected ? 600 : 500, color: meta.color }}>
                          {srv} {isCurrent && '(Active Now)'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {meta.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check size={16} style={{ color: 'var(--color-primary-light)' }} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reason for Change (Required) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Reason for Pivot <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Client requested personal dashboard during discussion"
              className="input"
              style={{ width: '100%', marginBottom: '0.5rem' }}
              required
            />
            {/* Quick Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {COMMON_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.6875rem',
                    padding: '0.2rem 0.5rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
              Additional Scope / Requirements Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details on custom modules, pricing discussion, or specific requests..."
              className="input"
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedService === activeService}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isSubmitting ? (
                'Recording Transition...'
              ) : (
                <>
                  <Check size={16} />
                  <span>Confirm Service Pivot</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
