'use client'

import React, { useState } from 'react'
import {
  X,
  Building2,
  Mail,
  Phone,
  User,
  ShieldCheck,
  Check,
  Loader2,
  Edit3,
} from 'lucide-react'
import { InstagramIcon } from '@/components/Icons'
import type { ExtendedLead, ChannelType, ServiceType } from '@/types/database'

interface EditLeadModalProps {
  isOpen: boolean
  onClose: () => void
  lead: ExtendedLead
  onSave: (updatedLead: ExtendedLead) => void
}

export function EditLeadModal({
  isOpen,
  onClose,
  lead,
  onSave,
}: EditLeadModalProps) {
  const [businessName, setBusinessName] = useState(lead.business_name || '')
  const [email, setEmail] = useState(lead.email || '')
  const [phone, setPhone] = useState(lead.phone || '')
  const [instagramHandle, setInstagramHandle] = useState(lead.instagram_handle || '')
  const [channel, setChannel] = useState<ChannelType>(lead.channel || 'Email')
  const [service, setService] = useState<ServiceType>(
    (lead.current_service as ServiceType) || (lead.initial_service as ServiceType) || 'Website Services'
  )
  const [companyType, setCompanyType] = useState<'limited' | 'sole_trader'>(
    lead.company_type || 'limited'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanName = businessName.trim()
    if (!cleanName) {
      setErrorMsg('Business name is required.')
      return
    }

    setIsSubmitting(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const cleanHandle = instagramHandle.trim().replace(/^@/, '')
      const cleanEmail = email.trim() || null
      const cleanPhone = phone.trim() || null

      const updatePayload = {
        business_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        instagram_handle: cleanHandle || null,
        channel,
        current_service: service,
        company_type: companyType,
        assigned_to: lead.assigned_to ?? null,
      }

      const { data, error } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', lead.id)
        .select('*')
        .single()

      if (error) {
        throw new Error(error.message)
      }

      // Log changes into activity log
      const changes: string[] = []
      if (cleanName !== lead.business_name) changes.push(`Name: "${cleanName}"`)
      if (cleanEmail !== (lead.email || null)) changes.push(`Email: "${cleanEmail || 'None'}"`)
      if (cleanPhone !== (lead.phone || null)) changes.push(`Phone: "${cleanPhone || 'None'}"`)
      if (cleanHandle !== (lead.instagram_handle || '')) changes.push(`Instagram: "@${cleanHandle || 'None'}"`)
      if (channel !== lead.channel) changes.push(`Primary Channel: ${channel}`)
      if (service !== (lead.current_service || lead.initial_service)) changes.push(`Service: ${service}`)
      if (companyType !== lead.company_type) changes.push(`PECR: ${companyType}`)

      const summary = changes.length > 0 ? changes.join(', ') : 'Details refreshed'

      await supabase.from('activity_log').insert({
        lead_id: lead.id,
        action_type: 'note',
        details: `Lead profile updated (${summary})`,
        created_by: lead.assigned_to || 'sales-1',
      })

      const { logUser } = await import('@/lib/logger')
      await logUser('update_lead_profile', 'lead', lead.id, {
        updatedFields: updatePayload,
      })

      if (data) {
        onSave(data as ExtendedLead)
      }
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update lead.'
      setErrorMsg(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 1050,
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
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: 0,
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
              }}
            >
              <Edit3 size={18} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  margin: 0,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Edit Lead</span>
                {lead.lead_code && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {lead.lead_code}
                  </span>
                )}
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Update company information, contact details, and follow-up channels.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-ghost btn-sm"
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              color: '#94a3b8',
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem 1.75rem' }}>
          {errorMsg && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.85rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Business Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.4rem',
                }}
              >
                Business / Lead Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Building2
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Clinic Ltd"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Service Offering Pitch */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.4rem',
                }}
              >
                Service Offering
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value as ServiceType)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.875rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                }}
              >
                <option value="Website Services">Website Services (UI/UX, Redesign, Web Apps)</option>
                <option value="Dashboard Services">Dashboard Services (Custom Admin, Analytics, Portals)</option>
                <option value="Micro Services">Micro Services (Dedicated APIs, Micro-Tools)</option>
                <option value="End to End Automation">End to End Automation (n8n, CRM & Ops Auto-Sync)</option>
                <option value="Cold Outreach">Cold Outreach (Outbound WhatsApp, IG & Email Campaigns)</option>
              </select>
            </div>

            {/* PECR Company Type */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.4rem',
                }}
              >
                Company Structure (PECR UK Compliance)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setCompanyType('limited')}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: companyType === 'limited' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                    backgroundColor: companyType === 'limited' ? '#f5f3ff' : '#ffffff',
                    color: companyType === 'limited' ? 'var(--primary)' : '#475569',
                    fontSize: '0.825rem',
                    fontWeight: companyType === 'limited' ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <div>Limited (Ltd / PLC)</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>B2B PECR auto-outreach</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCompanyType('sole_trader')}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: companyType === 'sole_trader' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                    backgroundColor: companyType === 'sole_trader' ? '#f5f3ff' : '#ffffff',
                    color: companyType === 'sole_trader' ? 'var(--primary)' : '#475569',
                    fontSize: '0.825rem',
                    fontWeight: companyType === 'sole_trader' ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <User size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <div>Sole Trader / Partnership</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Explicit consent required</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Primary Channel */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.4rem',
                }}
              >
                Primary Follow-up Channel
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in'] as ChannelType[]).map((ch) => {
                  const isSelected = channel === ch
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.825rem',
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        color: isSelected ? 'var(--primary)' : '#334155',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected && <Check size={13} />}
                      <span>{ch}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Contact Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '0.25rem' }}>
              {/* Email */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.4rem',
                  }}
                >
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@business.co.uk"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                      fontSize: '0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.4rem',
                  }}
                >
                  Phone / WhatsApp Number
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                    }}
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 7123 456789"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                      fontSize: '0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Instagram Handle */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.4rem',
                  }}
                >
                  Instagram Handle
                </label>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <InstagramIcon size={16} />
                  </div>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="business_handle"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                      fontSize: '0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid #f1f5f9',
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
              style={{ padding: '0.6rem 1.25rem', borderRadius: '8px' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                padding: '0.6rem 1.35rem',
                borderRadius: '8px',
                gap: '8px',
                minWidth: '120px',
                justifyContent: 'center',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
