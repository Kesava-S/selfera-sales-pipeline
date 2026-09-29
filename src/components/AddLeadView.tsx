'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PlusCircle, AlertCircle, Mail, Phone, Layers } from 'lucide-react'
import { InstagramIcon } from '@/components/Icons'
import { ChannelType } from '@/types/database'
import { CompanyAutocompleteInput } from '@/components/CompanyAutocompleteInput'

interface AddLeadViewProps {
  defaultCompany?: string
}

export function AddLeadView({ defaultCompany = '' }: AddLeadViewProps) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState(defaultCompany)
  const [channel, setChannel] = useState<ChannelType>('Email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const companyType: 'limited' | 'sole_trader' = 'limited'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{
    businessName?: string
    email?: string
    phone?: string
    instagramHandle?: string
  }>({})
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

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
          email: email.trim() || null,
          phone: phone.trim() || null,
          instagram_handle: instagramHandle.trim() || null,
          company_type: companyType,
          stage: 'New',
          follow_up_count: 0,
          next_follow_up: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (error) {
        const { logError } = await import('@/lib/logger')
        await logError(`Failed to insert lead: ${error.message}`, error, 'AddLeadView.handleSubmit', { businessName, channel })
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
          details: `Lead registered via ${channel}. Initial outreach task queued.`,
        })

        // User audit log
        const { logUser } = await import('@/lib/logger')
        await logUser('create_lead', 'lead', newLead.id, {
          business_name: newLead.business_name,
          channel: newLead.channel,
          company_type: newLead.company_type,
        })
      }

      router.push('/leads')
      router.refresh()
    } catch (err: unknown) {
      const { logError } = await import('@/lib/logger')
      await logError('Unexpected error during lead creation', err, 'AddLeadView.handleSubmit')
      const errorMsg = err instanceof Error ? err.message : 'Unknown database error'
      setErrors({ businessName: `Error connecting to database: ${errorMsg}` })
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
          Add New Prospect Lead
        </h1>
        <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Register new account and trigger initial outreach cadence.
        </p>
      </div>

      <div className="grid grid-cols-3">
        {/* Form Container */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          {hasAttemptedSubmit && Object.keys(errors).length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1.15rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#991b1b',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
              }}
            >
              <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
              <span>Please fill in the required fields highlighted below before proceeding.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label htmlFor="business_name" className="input-label">
                Company / Business Name <span className="required-star">*</span>
              </label>
              <CompanyAutocompleteInput
                id="business_name"
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
                    fontSize: '0.8rem',
                    marginTop: '0.4rem',
                    fontWeight: 500,
                  }}
                >
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{errors.businessName}</span>
                </div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="channel" className="input-label">
                Primary Outreach Cadence <span className="required-star">*</span>
              </label>
              <select
                id="channel"
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

            {/* Contact Details */}
            <div
              style={{
                marginTop: '1.25rem',
                marginBottom: '1.5rem',
                padding: '1.35rem 1.5rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div style={{ marginBottom: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={17} style={{ color: 'var(--primary)' }} />
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Contact Details
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: '#64748b', lineHeight: 1.5 }}>
                  Add all available contact options for this business. You can reach out via WhatsApp, Email, or Instagram, and any reply received can be logged immediately.
                </p>
              </div>

              {/* Email Address */}
              <div className="input-group" style={{ marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label htmlFor="email" className="input-label" style={{ margin: 0 }}>
                    Email Address {channel === 'Email' ? <span className="required-star">*</span> : null}
                  </label>
                  {channel === 'Email' ? (
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        backgroundColor: '#eff6ff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      Primary Cadence
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                      Optional
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errors.email) {
                        setErrors((prev) => ({ ...prev, email: undefined }))
                      }
                    }}
                    className="input-field"
                    style={{
                      paddingLeft: '2.5rem',
                      ...(errors.email
                        ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                        : {}),
                    }}
                    placeholder="contact@company.co.uk"
                  />
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.9rem',
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
                      fontSize: '0.8rem',
                      marginTop: '0.4rem',
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{errors.email}</span>
                  </div>
                )}
              </div>

              {/* Phone / WhatsApp Number */}
              <div className="input-group" style={{ marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label htmlFor="phone" className="input-label" style={{ margin: 0 }}>
                    Phone / WhatsApp Number {(channel === 'WhatsApp' || channel === 'Phone') ? <span className="required-star">*</span> : null}
                  </label>
                  {(channel === 'WhatsApp' || channel === 'Phone') ? (
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        color: '#16a34a',
                        backgroundColor: '#f0fdf4',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      Primary Cadence
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                      Optional
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      if (errors.phone) {
                        setErrors((prev) => ({ ...prev, phone: undefined }))
                      }
                    }}
                    className="input-field"
                    style={{
                      paddingLeft: '2.5rem',
                      ...(errors.phone
                        ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                        : {}),
                    }}
                    placeholder="+44 7123 456789"
                  />
                  <Phone
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.9rem',
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
                      fontSize: '0.8rem',
                      marginTop: '0.4rem',
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{errors.phone}</span>
                  </div>
                )}
              </div>

              {/* Instagram Handle */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label htmlFor="instagram" className="input-label" style={{ margin: 0 }}>
                    Instagram Handle {channel === 'Instagram' ? <span className="required-star">*</span> : null}
                  </label>
                  {channel === 'Instagram' ? (
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        color: '#db2777',
                        backgroundColor: '#fdf2f8',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      Primary Cadence
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                      Optional
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="instagram"
                    value={instagramHandle}
                    onChange={(e) => {
                      setInstagramHandle(e.target.value)
                      if (errors.instagramHandle) {
                        setErrors((prev) => ({ ...prev, instagramHandle: undefined }))
                      }
                    }}
                    className="input-field"
                    style={{
                      paddingLeft: '2.5rem',
                      ...(errors.instagramHandle
                        ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' }
                        : {}),
                    }}
                    placeholder="@company_handle"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '0.9rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <InstagramIcon size={16} />
                  </div>
                </div>
                {errors.instagramHandle && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      color: '#dc2626',
                      fontSize: '0.8rem',
                      marginTop: '0.4rem',
                      fontWeight: 500,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{errors.instagramHandle}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '1.75rem' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  padding: '0.85rem 1.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  borderRadius: '10px',
                  fontSize: '0.925rem',
                }}
              >
                <PlusCircle size={18} style={{ marginRight: '2px', flexShrink: 0 }} />
                <span>{isSubmitting ? 'Creating Lead...' : 'Create Lead & Schedule Cadence'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Info Card: Reachout Guidance & Cadence Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Direct Reachout Guidance Card */}
          <div
            className="card"
            style={{
              padding: '1.5rem 1.75rem',
              backgroundColor: '#f8faff',
              border: '1px solid #dbeafe',
              borderRadius: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '0.975rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Direct Reachout Ready
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              You can reach a company across <strong>Email</strong>, <strong>WhatsApp</strong>, and <strong>Instagram</strong>. Providing contact details allows you to launch direct messages from the lead card and automatically adapt your follow-up to whichever channel replies first.
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem 2rem' }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: '#0f172a' }}>Automatic Cadence</h2>
            <p className="text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Once created, this lead follows the standard Selfera follow-up cycle:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span className="badge badge-primary">Step 0</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Initial Outreach (Today)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: 'var(--muted)' }}>
                <span className="badge badge-neutral">Step 1</span>
                <span>Follow-up 1 (+3 working days)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: 'var(--muted)' }}>
                <span className="badge badge-neutral">Step 2</span>
                <span>Follow-up 2 (+5 working days)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: 'var(--muted)' }}>
                <span className="badge badge-neutral">Step 3</span>
                <span>Final Check (+14 working days)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
