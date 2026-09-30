'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Send,
  Mail,
  Phone,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Clock,
  AlertCircle,
  FileText,
  User,
  Building,
} from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/Icons'
import type { ExtendedLead, ExtendedTask, Template, ChannelType } from '@/types/database'
import {
  parseTemplateChannel,
  cleanTemplateText,
  getLeadCadenceStep,
  parseTemplateStep,
  CADENCE_STEPS,
  sanitizeTemplateInput,
} from '@/lib/templateUtils'

interface SendFollowupModalProps {
  isOpen: boolean
  onClose: () => void
  lead: ExtendedLead
  initialTask?: ExtendedTask | null
  initialChannel?: ChannelType
  onSentSuccess?: (result: {
    channel: ChannelType
    templateName: string
    message: string
  }) => void
}

function resolveTargetChannel(
  initialChannel?: ChannelType,
  task?: ExtendedTask | null,
  leadChannel?: ChannelType
): ChannelType {
  if (initialChannel) return initialChannel
  if (task?.channel) return task.channel as ChannelType
  if (task?.title) {
    const match = task.title.match(/\((WhatsApp|Instagram|Email|Phone|Walk-in)\)/i)
    if (match) {
      const raw = match[1].toLowerCase()
      if (raw === 'whatsapp') return 'WhatsApp'
      if (raw === 'instagram') return 'Instagram'
      if (raw === 'email') return 'Email'
      if (raw === 'phone') return 'Phone'
    }
  }
  return leadChannel || 'Email'
}

function findBestTemplate(
  templatesList: Template[],
  targetChannel: ChannelType,
  leadStep: number
): Template | undefined {
  const stepMatches = templatesList.filter(
    (t) => parseTemplateStep(t.name, t.step) === leadStep
  )
  const channelMatches = stepMatches.filter((t) => {
    const parsed = parseTemplateChannel(t.name, t.channel)
    return parsed.channel === targetChannel || parsed.channel === 'All'
  })
  if (channelMatches.length > 0) return channelMatches[0]
  if (stepMatches.length > 0) return stepMatches[0]
  return templatesList[0]
}

export function SendFollowupModal({
  isOpen,
  onClose,
  lead,
  initialTask,
  initialChannel,
  onSentSuccess,
}: SendFollowupModalProps) {
  const leadStep = getLeadCadenceStep(lead)
  const stepInfo = CADENCE_STEPS[leadStep]

  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [sendChannel, setSendChannel] = useState<ChannelType>(
    resolveTargetChannel(initialChannel, initialTask, lead.channel)
  )
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [customSubject, setCustomSubject] = useState<string>('')
  const [customBody, setCustomBody] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const [advanceCadence, setAdvanceCadence] = useState(true)

  // Fetch templates from database
  useEffect(() => {
    if (!isOpen) return

    const targetChannel = resolveTargetChannel(initialChannel, initialTask, lead.channel)
    setSendChannel(targetChannel)

    let isMounted = true
    const fetchTemplates = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data, error } = await supabase
          .from('templates')
          .select('*')
          .order('name', { ascending: true })

        if (!error && data && data.length > 0 && isMounted) {
          const list = (data as Template[]).map((t) => ({
            ...t,
            subject: cleanTemplateText(t.subject),
            body: cleanTemplateText(t.body),
          }))
          setTemplates(list)
          const matching = findBestTemplate(list, targetChannel, leadStep)
          if (matching) {
            setSelectedTemplateId(matching.id)
          } else if (list[0]) {
            setSelectedTemplateId(list[0].id)
          }
        } else if (isMounted) {
          setTemplates([])
          setSelectedTemplateId('')
        }
      } catch {
        if (isMounted) {
          setTemplates([])
          setSelectedTemplateId('')
        }
      }
    }

    fetchTemplates()

    return () => {
      isMounted = false
    }
  }, [isOpen, lead.channel, leadStep, initialChannel, initialTask])

  // Available templates strictly matching the lead's current cadence step
  const availableTemplates = useMemo(() => {
    return templates.filter((t) => parseTemplateStep(t.name, t.step) === leadStep)
  }, [templates, leadStep])

  // React to initialChannel or channel changes
  useEffect(() => {
    if (!isOpen || availableTemplates.length === 0) return
    const targetChannel = resolveTargetChannel(initialChannel, initialTask, lead.channel)
    setSendChannel(targetChannel)
    const matching = findBestTemplate(availableTemplates, targetChannel, leadStep)
    if (matching) {
      setSelectedTemplateId(matching.id)
    } else if (availableTemplates[0]) {
      setSelectedTemplateId(availableTemplates[0].id)
    }
  }, [isOpen, initialChannel, initialTask, lead.channel, leadStep, availableTemplates])

  // Current active template
  const currentTemplate = useMemo(() => {
    return (
      availableTemplates.find((t) => t.id === selectedTemplateId) ||
      availableTemplates[0] ||
      null
    )
  }, [availableTemplates, selectedTemplateId])

  // Extract variable names from template subject & body
  const detectedVariables = useMemo(() => {
    if (!currentTemplate) return []
    const combined = `${currentTemplate.subject || ''} ${currentTemplate.body}`
    const matches = combined.match(/\{([a-zA-Z0-9_-]+)\}/g) || []
    const uniqueKeys = Array.from(new Set(matches.map((m) => m.slice(1, -1))))
    return uniqueKeys
  }, [currentTemplate])

  // Initialize variable values based on lead
  useEffect(() => {
    if (!currentTemplate) return

    const initialVars: Record<string, string> = {}

    // Guess a contact name from email or company if not present
    let defaultContact = 'there'
    if (lead.email) {
      const emailPrefix = lead.email.split('@')[0]
      if (emailPrefix && !['info', 'contact', 'hello', 'admin', 'sales'].includes(emailPrefix.toLowerCase())) {
        defaultContact = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
      }
    }

    detectedVariables.forEach((key) => {
      if (key === 'business_name') {
        initialVars[key] = lead.business_name
      } else if (key === 'contact_name') {
        initialVars[key] = defaultContact
      } else if (key === 'channel') {
        initialVars[key] = sendChannel
      } else if (key === 'lead_code') {
        initialVars[key] = lead.lead_code || ''
      } else if (key === 'sender_name') {
        initialVars[key] = lead.assigned_to || 'Sales Team'
      } else if (key === 'email') {
        initialVars[key] = lead.email || ''
      } else if (key === 'phone') {
        initialVars[key] = lead.phone || ''
      } else {
        initialVars[key] = ''
      }
    })

    setVariables(initialVars)
  }, [currentTemplate, detectedVariables, lead, sendChannel])

  // Compile final message from template + variables
  const compiledSubject = useMemo(() => {
    if (!currentTemplate?.subject) return ''
    let res = cleanTemplateText(currentTemplate.subject)
    Object.entries(variables).forEach(([k, v]) => {
      res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    })
    return cleanTemplateText(res)
  }, [currentTemplate, variables])

  const compiledBody = useMemo(() => {
    if (!currentTemplate?.body) return ''
    let res = cleanTemplateText(currentTemplate.body)
    Object.entries(variables).forEach(([k, v]) => {
      res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    })
    return cleanTemplateText(res)
  }, [currentTemplate, variables])

  // Sync custom body when compiled body changes unless edited
  useEffect(() => {
    setCustomBody(compiledBody)
  }, [compiledBody])

  useEffect(() => {
    setCustomSubject(compiledSubject)
  }, [compiledSubject])

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

  const handleVariableChange = (key: string, value: string) => {
    setVariables((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleCopyMessage = async () => {
    try {
      const fullText = sendChannel === 'Email' && customSubject
        ? `Subject: ${customSubject}\n\n${customBody}`
        : customBody
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // Calculate next follow-up date (+3, +5, or +14 working days)
  const calculateNextDateForStep = (step: number): string => {
    const d = new Date()
    // Step 0 -> Step 1: +3 working days
    // Step 1 -> Step 2: +5 working days
    // Step 2 -> Step 3: +14 working days
    const daysToAdd = step === 0 ? 3 : step === 1 ? 5 : 14
    let added = 0
    while (added < daysToAdd) {
      d.setDate(d.getDate() + 1)
      const dayOfWeek = d.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++
      }
    }
    return d.toISOString().split('T')[0]
  }

  const handleSendViaPrimarySource = async () => {
    setIsSubmitting(true)

    const finalMessage = customBody.trim()
    const finalSubject = customSubject.trim()

    // 1. Open destination channel link
    if (sendChannel === 'WhatsApp') {
      const sanitizedPhone = (lead.phone || '').replace(/[^0-9+]/g, '')
      const waUrl = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(finalMessage)}`
      window.open(waUrl, '_blank')
    } else if (sendChannel === 'Email') {
      const mailtoUrl = `mailto:${encodeURIComponent(lead.email || '')}?subject=${encodeURIComponent(
        finalSubject
      )}&body=${encodeURIComponent(finalMessage)}`
      window.open(mailtoUrl, '_blank')
    } else if (sendChannel === 'Instagram') {
      await handleCopyMessage()
      const cleanHandle = (lead.instagram_handle || '').replace('@', '').trim()
      const igUrl = `https://instagram.com/${cleanHandle}`
      window.open(igUrl, '_blank')
    } else if (sendChannel === 'Phone') {
      await handleCopyMessage()
      const sanitizedPhone = (lead.phone || '').replace(/[^0-9+]/g, '')
      window.open(`tel:${sanitizedPhone}`, '_self')
    }

    // 2. Log activity & advance cadence in database
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Log in activity timeline
      await supabase.from('activity_log').insert({
        lead_id: lead.id,
        action_type: 'sent',
        details: `Sent ${stepInfo.name} via ${sendChannel} using template "${
          currentTemplate?.name || 'Custom'
        }". Message preview: ${finalMessage.slice(0, 120)}...`,
      })

      // Update lead stage and follow-up count if enabled
      if (advanceCadence) {
        if (leadStep === 0) {
          // Step 0 complete: Stage moves to Contacted, follow_up_count: 1, next follow up in +3 working days
          const nextDate = calculateNextDateForStep(0)
          await supabase
            .from('leads')
            .update({
              stage: 'Contacted',
              follow_up_count: 1,
              next_follow_up: nextDate,
              channel: sendChannel,
            })
            .eq('id', lead.id)

          if (initialTask?.id) {
            await supabase
              .from('tasks')
              .update({ status: 'completed' })
              .eq('id', initialTask.id)
          }

          await supabase.from('tasks').insert({
            lead_id: lead.id,
            title: `${lead.business_name}: Follow-up 1 (Step 1) (${sendChannel})`,
            description: `Scheduled Step 1 follow-up (+3 working days) via ${sendChannel}.`,
            status: 'open',
            task_type: 'sales_followup',
            due_date: nextDate,
          })
        } else if (leadStep === 1) {
          // Step 1 complete: follow_up_count: 2, next follow up in +5 working days
          const nextDate = calculateNextDateForStep(1)
          await supabase
            .from('leads')
            .update({
              stage: 'Contacted',
              follow_up_count: 2,
              next_follow_up: nextDate,
              channel: sendChannel,
            })
            .eq('id', lead.id)

          if (initialTask?.id) {
            await supabase
              .from('tasks')
              .update({ status: 'completed' })
              .eq('id', initialTask.id)
          }

          await supabase.from('tasks').insert({
            lead_id: lead.id,
            title: `${lead.business_name}: Follow-up 2 (Step 2) (${sendChannel})`,
            description: `Scheduled Step 2 follow-up (+5 working days) via ${sendChannel}.`,
            status: 'open',
            task_type: 'sales_followup',
            due_date: nextDate,
          })
        } else if (leadStep === 2) {
          // Step 2 complete: follow_up_count: 3, next follow up in +14 working days (Final Message)
          const nextDate = calculateNextDateForStep(2)
          await supabase
            .from('leads')
            .update({
              stage: 'Contacted',
              follow_up_count: 3,
              next_follow_up: nextDate,
              channel: sendChannel,
            })
            .eq('id', lead.id)

          if (initialTask?.id) {
            await supabase
              .from('tasks')
              .update({ status: 'completed' })
              .eq('id', initialTask.id)
          }

          await supabase.from('tasks').insert({
            lead_id: lead.id,
            title: `${lead.business_name}: Final Message (Step 3) (${sendChannel})`,
            description: `Scheduled Step 3 Final Message (+14 working days) via ${sendChannel}.`,
            status: 'open',
            task_type: 'sales_followup',
            due_date: nextDate,
          })
        } else {
          // Step 3 complete: Cadence finished
          await supabase
            .from('leads')
            .update({
              stage: 'Contacted',
              follow_up_count: 4,
              next_follow_up: null,
              channel: sendChannel,
            })
            .eq('id', lead.id)

          if (initialTask?.id) {
            await supabase
              .from('tasks')
              .update({ status: 'completed' })
              .eq('id', initialTask.id)
          }
        }
      }

      // Log User Audit
      const { logUser } = await import('@/lib/logger')
      await logUser('send_outreach', 'lead', lead.id, {
        channel: sendChannel,
        template: currentTemplate?.name,
        advanceCadence,
      })

      onSentSuccess?.({
        channel: sendChannel,
        templateName: currentTemplate?.name || 'Custom',
        message: finalMessage,
      })

      setIsSubmitting(false)
      onClose()
    } catch {
      setIsSubmitting(false)
      onClose()
    }
  }

  const getChannelIconNode = (ch: ChannelType) => {
    switch (ch) {
      case 'WhatsApp':
        return <MessageSquare size={14} />
      case 'Email':
        return <Mail size={14} />
      case 'Instagram':
        return <InstagramIcon size={14} />
      case 'Phone':
        return <Phone size={14} />
      default:
        return <Send size={14} />
    }
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
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
        padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
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
              <Send size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  {stepInfo.name}
                </h2>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#64748b',
                  }}
                >
                  ({lead.business_name})
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#2563eb',
                  }}
                >
                  • {stepInfo.timing}
                </span>
              </div>
              <p className="text-muted" style={{ margin: '2px 0 0', fontSize: '0.785rem' }}>
                {stepInfo.description} ({stepInfo.visibilityRule})
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
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem',
          }}
        >
          {/* Step 1: Template Selection Bar */}
          <div
            style={{
              padding: '0.95rem 1.15rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={15} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {stepInfo.shortLabel} Templates
                </span>
              </div>

              {/* Source Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Send via:</span>
                {(['WhatsApp', 'Email', 'Instagram', 'Phone'] as ChannelType[]).map((ch) => {
                  const isAvailable =
                    (ch === 'WhatsApp' && !!lead.phone) ||
                    (ch === 'Email' && !!lead.email) ||
                    (ch === 'Instagram' && !!lead.instagram_handle) ||
                    (ch === 'Phone' && !!lead.phone)

                  const isSelected = sendChannel === ch

                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        setSendChannel(ch)
                        const matching = availableTemplates.find((t) => {
                          const parsed = parseTemplateChannel(t.name, t.channel)
                          return parsed.channel === ch
                        })
                        if (matching) {
                          setSelectedTemplateId(matching.id)
                        } else if (availableTemplates[0]) {
                          setSelectedTemplateId(availableTemplates[0].id)
                        }
                      }}
                      disabled={!isAvailable}
                      style={{
                        padding: '0.2rem 0.55rem',
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : isAvailable ? '#cbd5e1' : '#f1f5f9',
                        backgroundColor: isSelected ? 'var(--primary-bg)' : isAvailable ? '#ffffff' : '#f8fafc',
                        color: isSelected ? 'var(--primary)' : isAvailable ? '#334155' : '#cbd5e1',
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      title={isAvailable ? `Send via ${ch}` : `No ${ch} contact details for this lead`}
                    >
                      {getChannelIconNode(ch)}
                      <span>{ch}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Template Selector Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                  Active Template for {stepInfo.shortLabel}:
                </span>
                <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>
                  {availableTemplates.length} available
                </span>
              </div>
              {availableTemplates.length === 0 ? (
                <div
                  style={{
                    padding: '0.55rem 0.85rem',
                    backgroundColor: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: '#64748b',
                  }}
                >
                  No database templates found for {stepInfo.shortLabel}. You can compose a custom message below.
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="input-field"
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    padding: '0.55rem 0.85rem',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {availableTemplates.map((tpl) => {
                    const parsed = parseTemplateChannel(tpl.name, tpl.channel)
                    const tag = parsed.channel !== 'All' ? `[${parsed.channel}] ` : ''
                    return (
                      <option key={tpl.id} value={tpl.id}>
                        {tag}{parsed.cleanName}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>
          </div>

          {/* 2-Column Section: Variables Editor on Left, Live Message Preview on Right */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(250px, 300px) 1fr',
              gap: '1.15rem',
              alignItems: 'start',
            }}
          >
            {/* Step 2: Dynamic Variable Inputs */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Step 2: Variable Values
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
                Type variable values to customize placeholders in this message:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {detectedVariables.length === 0 ? (
                  <span style={{ fontSize: '0.785rem', color: '#94a3b8' }}>
                    No dynamic placeholders detected in this template.
                  </span>
                ) : (
                  detectedVariables.map((vKey) => {
                    const label = vKey
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())

                    return (
                      <div key={vKey}>
                        <label
                          htmlFor={`var-${vKey}`}
                          style={{
                            display: 'block',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            color: '#475569',
                            marginBottom: '0.2rem',
                          }}
                        >
                          {label} <code style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{`{${vKey}}`}</code>
                        </label>
                        <input
                          type="text"
                          id={`var-${vKey}`}
                          value={variables[vKey] || ''}
                          onChange={(e) => handleVariableChange(vKey, e.target.value)}
                          className="input-field"
                          style={{
                            padding: '0.4rem 0.65rem',
                            fontSize: '0.8125rem',
                            borderRadius: '7px',
                          }}
                          placeholder={`Enter ${label}...`}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Live Message Preview & Customizer */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Live Message Preview
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    gap: '4px',
                    color: copied ? 'var(--success)' : 'var(--primary)',
                    backgroundColor: copied ? '#ecfdf5' : '#ffffff',
                    border: '1px solid',
                    borderColor: copied ? '#a7f3d0' : '#e2e8f0',
                  }}
                  title="Copy compiled message to clipboard"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>

              {/* Email Subject line if applicable */}
              {sendChannel === 'Email' && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Email Subject Line:
                  </label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(sanitizeTemplateInput(e.target.value))}
                    className="input-field"
                    style={{
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  />
                </div>
              )}

              {/* Editable Final Message Text */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: '0.2rem',
                  }}
                >
                  Message Body (Customizable):
                </label>
                <textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(sanitizeTemplateInput(e.target.value))}
                  rows={8}
                  className="input-field"
                  style={{
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.825rem',
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    backgroundColor: '#fafbfc',
                  }}
                />
              </div>

              {/* Target Destination & Details Strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.775rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#64748b' }}>Destination:</span>
                  <strong style={{ color: '#0f172a' }}>
                    {sendChannel === 'WhatsApp' && (lead.phone || 'No phone set')}
                    {sendChannel === 'Email' && (lead.email || 'No email set')}
                    {sendChannel === 'Instagram' && (`@${(lead.instagram_handle || '').replace('@', '')}` || 'No Instagram set')}
                    {sendChannel === 'Phone' && (lead.phone || 'No phone set')}
                  </strong>
                </div>

                <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                  {customBody.length} characters
                </div>
              </div>
            </div>
          </div>

          {/* Cadence Checkbox Option */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.65rem 0.85rem',
              backgroundColor: '#f8faff',
              border: '1px solid #dbeafe',
              borderRadius: '8px',
              fontSize: '0.785rem',
              color: '#334155',
            }}
          >
            <input
              type="checkbox"
              id="advance_cadence_check"
              checked={advanceCadence}
              onChange={(e) => setAdvanceCadence(e.target.checked)}
              style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="advance_cadence_check" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
              {leadStep === 0 && 'Update lead state from New to Contacted and schedule Step 1: Follow-up 1 (+3 working days)'}
              {leadStep === 1 && 'Advance cadence and schedule Step 2: Follow-up 2 (+5 working days)'}
              {leadStep === 2 && 'Advance cadence and schedule Step 3: Final Message (+14 working days)'}
              {leadStep === 3 && 'Complete cadence (all 4 outreach steps finished)'}
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleSendViaPrimarySource}
              disabled={isSubmitting || !customBody.trim()}
              className="btn btn-primary"
              style={{
                padding: '0.55rem 1.35rem',
                fontSize: '0.85rem',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              {getChannelIconNode(sendChannel)}
              <span>
                {isSubmitting
                  ? 'Logging...'
                  : `Send via ${sendChannel}`}
              </span>
              <ExternalLink size={13} style={{ opacity: 0.8 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
