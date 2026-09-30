'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  PlusCircle,
  AlertCircle,
  Mail,
  Phone,
  Layers,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { InstagramIcon } from '@/components/Icons'
import { ChannelType, ServiceType } from '@/types/database'
import { CompanyAutocompleteInput } from '@/components/CompanyAutocompleteInput'

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  defaultCompany?: string
  onSuccess?: (newLeadId: string) => void
}

export function AddLeadModal({
  isOpen,
  onClose,
  defaultCompany = '',
  onSuccess,
}: AddLeadModalProps) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState(defaultCompany)
  const [service, setService] = useState<ServiceType>('Website Services')
  const [channel, setChannel] = useState<ChannelType>('Email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState<{
    businessName?: string
    email?: string
    phone?: string
    instagramHandle?: string
  }>({})
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  // Reset or prefill when modal opens or defaultCompany changes
  useEffect(() => {
    if (isOpen) {
      setBusinessName(defaultCompany)
      setChannel('Email')
      setEmail('')
      setPhone('')
      setInstagramHandle('')
      setErrors({})
      setHasAttemptedSubmit(false)
      setIsSubmitting(false)
      setIsSuccess(false)
    }
  }, [isOpen, defaultCompany])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setHasAttemptedSubmit(true)

    const newErrors: {
      businessName?: string
      email?: string
      phone?: string
      instagramHandle?: string
    } = {}

    if (!businessName.trim()) {
      newErrors.businessName = 'Please enter the company or business name.'
    }

    if (channel === 'Email') {
      if (!email.trim()) {
        newErrors.email = 'Email address is required when Email is chosen as primary cadence channel.'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address (e.g. contact@company.co.uk).'
      }
    } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address format.'
    }

    if ((channel === 'WhatsApp' || channel === 'Phone') && !phone.trim()) {
      newErrors.phone = `Phone number is required when ${channel} is chosen as primary cadence channel.`
    }

    if (channel === 'Instagram' && !instagramHandle.trim()) {
      newErrors.instagramHandle = 'Instagram handle is required when Instagram is chosen as primary cadence channel.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          business_name: businessName.trim(),
          channel,
          initial_service: service,
          current_service: service,
          email: email.trim() || null,
          phone: phone.trim() || null,
          instagram_handle: instagramHandle.trim() || null,
          company_type: 'limited',
          stage: 'New',
          follow_up_count: 0,
          next_follow_up: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (error) {
        const { logError } = await import('@/lib/logger')
        await logError(`Failed to insert lead: ${error.message}`, error, 'AddLeadModal.handleSubmit', { businessName, channel })
        setErrors({ businessName: `Database error: ${error.message}` })
        setIsSubmitting(false)
        return
      }

      if (newLead) {
        // Create initial task in today's queue
        await supabase.from('tasks').insert({
          title: `${newLead.business_name}: Send First Outreach (${channel})`,
          description: `Initial outreach via ${channel}.`,
          lead_id: newLead.id,
          status: 'open',
          task_type: 'sales_followup',
          due_date: new Date().toISOString().split('T')[0],
        })

        // Add activity log
        await supabase.from('activity_log').insert({
          lead_id: newLead.id,
          action_type: 'system',
          details: `Lead registered via ${channel} for ${service}. Initial outreach task queued.`,
        })

        // User audit log
        const { logUser } = await import('@/lib/logger')
        await logUser('create_lead', 'lead', newLead.id, {
          business_name: newLead.business_name,
          channel: newLead.channel,
          company_type: newLead.company_type,
          service: service,
        })

        setIsSuccess(true)
        setTimeout(() => {
          onSuccess?.(newLead.id)
          onClose()
          router.refresh()
        }, 350)
      } else {
        setIsSubmitting(false)
      }
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError('Unexpected error during lead creation', err, 'AddLeadModal.handleSubmit')
      const errorMsg = err instanceof Error ? err.message : 'Unknown database error'
      setErrors({ businessName: `Error connecting to database: ${errorMsg}` })
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #bfdbfe',
              }}
            >
              <PlusCircle size={19} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Add New Prospect Lead
              </h2>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.785rem' }}>
                Register new account and trigger initial outreach cadence.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: '1.4rem 1.5rem',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {hasAttemptedSubmit && Object.keys(errors).length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#991b1b',
                fontSize: '0.825rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
              <span>Please fill in the required fields highlighted below before proceeding.</span>
            </div>
          )}

          <form id="add-lead-modal-form" onSubmit={handleSubmit} noValidate>
            {/* Business Name */}
            <div className="input-group" style={{ marginBottom: '1.15rem' }}>
              <label htmlFor="modal_business_name" className="input-label">
                Company / Business Name <span className="required-star">*</span>
              </label>
              <CompanyAutocompleteInput
                id="modal_business_name"
                value={businessName}
                onChange={(val) => {
                  setBusinessName(val)
                  if (errors.businessName) {
                    setErrors((prev) => ({ ...prev, businessName: undefined }))
                  }
                }}
                hasError={Boolean(errors.businessName)}
                placeholder="Search existing company or type new name..."
                autoFocus
              />
              {errors.businessName && (
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
                  <span>{errors.businessName}</span>
                </div>
              )}
            </div>

            {/* Service Offering Pitch */}
            <div className="input-group" style={{ marginBottom: '1.15rem' }}>
              <label htmlFor="modal_service" className="input-label">
                Service Offering Pitch <span className="required-star">*</span>
              </label>
              <select
                id="modal_service"
                value={service}
                onChange={(e) => setService(e.target.value as ServiceType)}
                className="input-field"
              >
                <option value="Website Services">Website Services (UI/UX, Redesign, Web Apps)</option>
                <option value="Dashboard Services">Dashboard Services (Custom Admin, Analytics, Portals)</option>
                <option value="Micro Services">Micro Services (Dedicated APIs, Micro-Tools)</option>
                <option value="End to End Automation">End to End Automation (n8n, CRM & Ops Auto-Sync)</option>
                <option value="Cold Outreach">Cold Outreach (Outbound WhatsApp, IG & Email Campaigns)</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Initial marketing angle. If the client asks for another service later, you can log the pivot anytime.
              </span>
            </div>

            {/* Primary Channel Cadence */}
            <div className="input-group" style={{ marginBottom: '1.15rem' }}>
              <label htmlFor="modal_channel" className="input-label">
                Primary Outreach Cadence <span className="required-star">*</span>
              </label>
              <select
                id="modal_channel"
                value={channel}
                onChange={(e) => {
                  const newChannel = e.target.value as ChannelType
                  setChannel(newChannel)
                  setErrors({})
                }}
                className="input-field"
              >
                <option value="Email">Email (Automated via n8n / Cadence)</option>
                <option value="WhatsApp">WhatsApp (Manual Follow-up Task)</option>
                <option value="Instagram">Instagram (Manual DM Task)</option>
                <option value="Phone">Phone (Manual Call Task)</option>
                <option value="Walk-in">Walk-in (Field Sales Task)</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Kicks off Step 0. You can reach out via any saved contact option.
              </span>
            </div>

            {/* Contact Details Container */}
            <div
              style={{
                marginTop: '1rem',
                marginBottom: '1rem',
                padding: '1.15rem 1.25rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Layers size={15} style={{ color: 'var(--primary)' }} />
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Contact Details
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.785rem', color: '#64748b' }}>
                  Add available contact channels. Primary cadence channel requires input.
                </p>
              </div>

              {/* Email Address */}
              <div className="input-group" style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label htmlFor="modal_email" className="input-label" style={{ margin: 0, fontSize: '0.8rem' }}>
                    Email Address {channel === 'Email' ? <span className="required-star">*</span> : null}
                  </label>
                  {channel === 'Email' ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        backgroundColor: '#eff6ff',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                      }}
                    >
                      Primary Cadence
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Optional</span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="modal_email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errors.email) {
                        setErrors((prev) => ({ ...prev, email: undefined }))
                      }
                    }}
                    className="input-field"
                    style={{
                      paddingLeft: '2.35rem',
                      fontSize: '0.85rem',
                      ...(errors.email
                        ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                        : {}),
                    }}
                    placeholder="contact@company.co.uk"
                  />
                  <Mail
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                {errors.email && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      color: '#dc2626',
                      fontSize: '0.75rem',
                      marginTop: '0.3rem',
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{errors.email}</span>
                  </div>
                )}
              </div>

              {/* Phone / WhatsApp */}
              <div className="input-group" style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label htmlFor="modal_phone" className="input-label" style={{ margin: 0, fontSize: '0.8rem' }}>
                    Phone / WhatsApp {(channel === 'WhatsApp' || channel === 'Phone') ? <span className="required-star">*</span> : null}
                  </label>
                  {(channel === 'WhatsApp' || channel === 'Phone') ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#16a34a',
                        backgroundColor: '#f0fdf4',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                      }}
                    >
                      Primary Cadence
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Optional</span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="modal_phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      if (errors.phone) {
                        setErrors((prev) => ({ ...prev, phone: undefined }))
                      }
                    }}
                    className="input-field"
                    style={{
                      paddingLeft: '2.35rem',
                      fontSize: '0.85rem',
                      ...(errors.phone
                        ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                        : {}),
                    }}
                    placeholder="+44 7123 456789"
                  />
                  <Phone
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                {errors.phone && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      color: '#dc2626',
                      fontSize: '0.75rem',
                      marginTop: '0.3rem',
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{errors.phone}</span>
                  </div>
                )}
              </div>

              {/* Instagram Handle */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label htmlFor="modal_instagram" className="input-label" style={{ margin: 0, fontSize: '0.8rem' }}>
                    Instagram Handle {channel === 'Instagram' ? <span className="required-star">*</span> : null}
                  </label>
                  {channel === 'Instagram' ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#db2777',
                        backgroundColor: '#fdf2f8',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                      }}
                    >
                      Primary Cadence
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Optional</span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="modal_instagram"
                    value={instagramHandle}
                    onChange={(e) => {
                      setInstagramHandle(e.target.value)
                      if (errors.instagramHandle) {
                        setErrors((prev) => ({ ...prev, instagramHandle: undefined }))
                      }
                    }}
                    className="input-field"
                    style={{
                      paddingLeft: '2.35rem',
                      fontSize: '0.85rem',
                      ...(errors.instagramHandle
                        ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                        : {}),
                    }}
                    placeholder="@company_handle"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <InstagramIcon size={15} />
                  </div>
                </div>
                {errors.instagramHandle && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      color: '#dc2626',
                      fontSize: '0.75rem',
                      marginTop: '0.3rem',
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{errors.instagramHandle}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Cadence note */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.65rem 0.85rem',
                backgroundColor: '#f8faff',
                border: '1px solid #dbeafe',
                borderRadius: '8px',
                fontSize: '0.775rem',
                color: '#475569',
              }}
            >
              <ShieldCheck size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>
                Standard cadence starts automatically at <strong>Step 0 (Today)</strong>, followed by steps at +3, +5, and +14 working days.
              </span>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 1.15rem', fontSize: '0.85rem', borderRadius: '8px' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-lead-modal-form"
            disabled={isSubmitting || isSuccess}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1.35rem',
              fontSize: '0.85rem',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isSuccess ? (
              <>
                <CheckCircle2 size={16} />
                <span>Lead Created!</span>
              </>
            ) : isSubmitting ? (
              <span>Creating...</span>
            ) : (
              <>
                <PlusCircle size={16} />
                <span>Create Lead & Start Cadence</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
