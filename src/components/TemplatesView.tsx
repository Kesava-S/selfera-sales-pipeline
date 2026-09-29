'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText,
  Copy,
  Check,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Layers,
  CheckCircle,
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
} from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/Icons'
import { Template, TemplateChannel, CadenceStep, ExtendedLead } from '@/types/database'
import { TemplateModal } from '@/components/TemplateModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import {
  parseTemplateChannel,
  formatTemplateNameWithChannel,
  cleanTemplateText,
  parseTemplateStep,
  CADENCE_STEPS,
} from '@/lib/templateUtils'

interface TemplatesViewProps {
  initialTemplates?: Template[] | null
  initialLeads?: ExtendedLead[] | null
}

const SUPPORTED_VARS = [
  '{business_name}',
  '{contact_name}',
  '{channel}',
  '{email}',
  '{phone}',
  '{lead_code}',
  '{sender_name}',
]

export function TemplatesView({ initialTemplates = [], initialLeads = [] }: TemplatesViewProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates || [])
  const [leads, setLeads] = useState<ExtendedLead[]>(initialLeads || [])
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialLeads && initialLeads.length > 0 ? initialLeads[0].id : ''
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<'All' | TemplateChannel>('All')
  const [stepFilter, setStepFilter] = useState<'All' | CadenceStep>('All')

  // Dynamic preview variables initialized from database leads if available
  const [previewVars, setPreviewVars] = useState(() => {
    const firstLead = initialLeads && initialLeads.length > 0 ? initialLeads[0] : null
    return {
      business_name: firstLead?.business_name || '',
      contact_name: firstLead?.business_name || '',
      channel: (firstLead?.channel as TemplateChannel) || 'WhatsApp',
      email: firstLead?.email || '',
      phone: firstLead?.phone || '',
      lead_code: firstLead?.lead_code || '',
      sender_name: 'Sales Team',
    }
  })

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)

  // Fetch templates from database if not supplied
  useEffect(() => {
    if (!initialTemplates || initialTemplates.length === 0) {
      const loadTemplates = async () => {
        try {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data, error } = await supabase
            .from('templates')
            .select('*')
            .order('created_at', { ascending: true })
          if (!error && data) {
            setTemplates(data)
          }
        } catch {
          // Keep empty if failed
        }
      }
      loadTemplates()
    }
  }, [initialTemplates])

  // Fetch leads from database if not supplied
  useEffect(() => {
    if (!initialLeads || initialLeads.length === 0) {
      const loadLeads = async () => {
        try {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(25)
          if (!error && data && data.length > 0) {
            setLeads(data as ExtendedLead[])
            if (!selectedLeadId) {
              setSelectedLeadId(data[0].id)
            }
          }
        } catch {
          // Keep empty if failed
        }
      }
      loadLeads()
    }
  }, [initialLeads, selectedLeadId])

  // Sync preview variables whenever selected lead changes
  useEffect(() => {
    if (leads.length > 0) {
      const found = leads.find((l) => l.id === selectedLeadId) || leads[0]
      if (found) {
        setPreviewVars({
          business_name: found.business_name || '',
          contact_name: found.business_name || '',
          channel: (found.channel as TemplateChannel) || 'WhatsApp',
          email: found.email || '',
          phone: found.phone || '',
          lead_code: found.lead_code || '',
          sender_name: 'Sales Team',
        })
      }
    }
  }, [selectedLeadId, leads])

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Interpolation helper: replaces variables and unescapes \n
  const renderInterpolatedText = (text: string | null) => {
    if (!text) return ''
    let result = cleanTemplateText(text)
    result = result.replace(/{business_name}/g, previewVars.business_name || '{business_name}')
    result = result.replace(/{contact_name}/g, previewVars.contact_name || '{contact_name}')
    result = result.replace(/{channel}/g, previewVars.channel || '{channel}')
    result = result.replace(/{email}/g, previewVars.email || '{email}')
    result = result.replace(/{phone}/g, previewVars.phone || '{phone}')
    result = result.replace(/{lead_code}/g, previewVars.lead_code || '{lead_code}')
    result = result.replace(/{sender_name}/g, previewVars.sender_name || '{sender_name}')
    return result
  }

  // Detect which variables are used in a template (including custom variables)
  const getUsedVariables = (template: Template) => {
    const combined = `${template.subject || ''} ${template.body}`
    const matches = combined.match(/\{([a-zA-Z0-9_-]+)\}/g) || []
    return Array.from(new Set(matches))
  }

  const copyTemplate = (template: Template) => {
    const subjectResolved = renderInterpolatedText(template.subject)
    const bodyResolved = renderInterpolatedText(template.body)
    const textToCopy = subjectResolved ? `Subject: ${subjectResolved}\n\n${bodyResolved}` : bodyResolved

    navigator.clipboard.writeText(textToCopy)
    setCopiedId(template.id)
    showToast(`"${template.name}" copied to clipboard!`)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setModalOpen(true)
  }

  // Open modal for Edit
  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template)
    setModalOpen(true)
  }

  // Save (Create or Update)
  const handleSaveTemplate = async (templateData: {
    id?: string
    name: string
    subject: string | null
    body: string
    channel?: TemplateChannel
    step?: CadenceStep | null
  }) => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      if (templateData.id) {
        // Update existing
        const { data } = await supabase
          .from('templates')
          .update({
            name: templateData.name,
            subject: templateData.subject,
            body: templateData.body,
          })
          .eq('id', templateData.id)
          .select()
          .single()

        if (data) {
          setTemplates((prev) =>
            prev.map((t) =>
              t.id === data.id
                ? {
                    ...(data as Template),
                    channel: templateData.channel,
                    step: templateData.step,
                  }
                : t
            )
          )
        } else {
          setTemplates((prev) =>
            prev.map((t) =>
              t.id === templateData.id
                ? {
                    ...t,
                    name: templateData.name,
                    subject: templateData.subject,
                    body: templateData.body,
                    channel: templateData.channel,
                    step: templateData.step,
                  }
                : t
            )
          )
        }
        showToast('Template updated successfully.')
      } else {
        // Create new
        const { data } = await supabase
          .from('templates')
          .insert([
            {
              name: templateData.name,
              subject: templateData.subject,
              body: templateData.body,
            },
          ])
          .select()
          .single()

        if (data) {
          setTemplates((prev) => [
            ...prev,
            {
              ...(data as Template),
              channel: templateData.channel,
              step: templateData.step,
            },
          ])
        } else {
          setTemplates((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              name: templateData.name,
              subject: templateData.subject,
              body: templateData.body,
              channel: templateData.channel,
              step: templateData.step,
              created_at: new Date().toISOString(),
            },
          ])
        }
        showToast('New template created successfully.')
      }
    } catch {
      // Local fallback
      if (templateData.id) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === templateData.id
              ? {
                  ...t,
                  name: templateData.name,
                  subject: templateData.subject,
                  body: templateData.body,
                  channel: templateData.channel,
                  step: templateData.step,
                }
              : t
          )
        )
        showToast('Template updated.')
      } else {
        setTemplates((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: templateData.name,
            subject: templateData.subject,
            body: templateData.body,
            channel: templateData.channel,
            step: templateData.step,
            created_at: new Date().toISOString(),
          },
        ])
        showToast('New template created.')
      }
    }
  }

  // Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const targetId = deleteTarget.id

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.from('templates').delete().eq('id', targetId)

      if (error) {
        console.error('Failed to delete template:', error)
      }
      setTemplates((prev) => prev.filter((t) => t.id !== targetId))
      showToast(`Template "${deleteTarget.name}" deleted.`)
    } catch (err) {
      console.error('Delete template error:', err)
      setTemplates((prev) => prev.filter((t) => t.id !== targetId))
    } finally {
      setDeleteTarget(null)
    }
  }

  const renderChannelBadge = (channel: TemplateChannel) => {
    switch (channel) {
      case 'WhatsApp':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'transparent',
              color: '#16a34a',
              border: 'none',
              fontSize: '0.75rem',
              padding: 0,
              gap: '4px',
            }}
          >
            <MessageCircle size={11} />
            <span>WhatsApp</span>
          </span>
        )
      case 'Instagram':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'transparent',
              color: '#db2777',
              border: 'none',
              fontSize: '0.75rem',
              padding: 0,
              gap: '4px',
            }}
          >
            <InstagramIcon size={11} />
            <span>Instagram</span>
          </span>
        )
      case 'SMS':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'transparent',
              color: '#0284c7',
              border: 'none',
              fontSize: '0.75rem',
              padding: 0,
              gap: '4px',
            }}
          >
            <Phone size={11} />
            <span>SMS</span>
          </span>
        )
      case 'Facebook':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'transparent',
              color: '#1877f2',
              border: 'none',
              fontSize: '0.75rem',
              padding: 0,
              gap: '4px',
            }}
          >
            <FacebookIcon size={11} />
            <span>Facebook</span>
          </span>
        )
      case 'Email':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'transparent',
              color: '#7c3aed',
              border: 'none',
              fontSize: '0.75rem',
              padding: 0,
              gap: '4px',
            }}
          >
            <Mail size={11} />
            <span>Email</span>
          </span>
        )
      default:
        return (
          <span
            className="badge badge-neutral"
            style={{
              fontSize: '0.75rem',
              padding: 0,
              gap: '4px',
            }}
          >
            <Layers size={11} />
            <span>All Channels</span>
          </span>
        )
    }
  }

  const filteredTemplates = templates.filter((template) => {
    if (channelFilter !== 'All') {
      const parsed = parseTemplateChannel(template.name, template.channel)
      if (parsed.channel !== channelFilter && parsed.channel !== 'All') return false
    }
    if (stepFilter !== 'All') {
      const templateStep = parseTemplateStep(template.name, template.step)
      if (templateStep !== stepFilter) return false
    }
    return true
  })

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.825rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}
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
            Outreach Message Templates
          </h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Manage dynamic message templates with live variable placeholders for personalized outreach.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreate}
            className="btn btn-primary btn-sm"
            style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', borderRadius: '8px', gap: '6px' }}
          >
            <Plus size={15} />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Dynamic Variable Demonstration / Preview Toolbar */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1.15rem',
          borderRadius: '10px',
          marginBottom: '1.25rem',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary)' }}>
            <Eye size={15} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
              Dynamic Preview Lead:
            </span>
          </div>

          {leads.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Select Lead:</span>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="input-field"
                style={{
                  padding: '0.22rem 0.55rem',
                  fontSize: '0.775rem',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  maxWidth: '180px',
                }}
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.business_name} {l.lead_code ? `(${l.lead_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Company:</span>
              <input
                type="text"
                value={previewVars.business_name}
                onChange={(e) => setPreviewVars((p) => ({ ...p, business_name: e.target.value }))}
                className="input-field"
                style={{ width: '130px', padding: '0.22rem 0.55rem', fontSize: '0.775rem', borderRadius: '6px' }}
                placeholder="Company name..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Contact:</span>
              <input
                type="text"
                value={previewVars.contact_name}
                onChange={(e) => setPreviewVars((p) => ({ ...p, contact_name: e.target.value }))}
                className="input-field"
                style={{ width: '110px', padding: '0.22rem 0.55rem', fontSize: '0.775rem', borderRadius: '6px' }}
                placeholder="Contact name..."
              />
            </div>
          </div>
        </div>

        {/* Supported Variables Guide Tooltip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Available variables:</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <code style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#0284c7' }}>
              &#123;business_name&#125;
            </code>
            <code style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#0284c7' }}>
              &#123;contact_name&#125;
            </code>
            <code style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#0284c7' }}>
              &#123;channel&#125;
            </code>
            <code style={{ fontSize: '0.68rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', color: '#0284c7' }}>
              &#123;phone&#125;
            </code>
          </div>
        </div>
      </div>

      {/* Cadence Step Filters */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.45rem' }}>
          <Layers size={14} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Filter by Cadence Step
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            flexWrap: 'wrap',
          }}
        >
          {([
            { key: 'All', label: 'All Cadence Steps', sub: 'Entire Pipeline' },
            { key: 0, label: 'Step 0: Initial Outreach', sub: 'New -> Contacted' },
            { key: 1, label: 'Step 1: Follow-up 1', sub: '+3 working days' },
            { key: 2, label: 'Step 2: Follow-up 2', sub: '+5 working days' },
            { key: 3, label: 'Step 3: Final Message', sub: '+14 working days' },
          ] as const).map((item) => {
            const isSelected = stepFilter === item.key
            const count =
              item.key === 'All'
                ? templates.length
                : templates.filter((t) => parseTemplateStep(t.name, t.step) === item.key).length

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStepFilter(item.key as 'All' | CadenceStep)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.775rem',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--primary)' : '#e2e8f0',
                  backgroundColor: isSelected ? 'var(--primary)' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#334155',
                  boxShadow: isSelected ? '0 1px 3px rgba(79, 70, 229, 0.25)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                  cursor: 'pointer',
                  transform: 'none',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600 }}>{item.label}</span>
                  <span
                    style={{
                      fontSize: '0.675rem',
                      opacity: isSelected ? 0.9 : 0.65,
                      fontWeight: 400,
                    }}
                  >
                    {item.sub}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.1rem 0.45rem',
                    minWidth: '1.25rem',
                    textAlign: 'center',
                    borderRadius: '9999px',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#475569',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Channel Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        {[
          { key: 'All', label: 'All Channels' },
          { key: 'WhatsApp', label: 'WhatsApp' },
          { key: 'Instagram', label: 'Instagram' },
          { key: 'SMS', label: 'SMS / Text' },
          { key: 'Facebook', label: 'Facebook' },
          { key: 'Email', label: 'Email' },
        ].map((item) => {
          const isSelected = channelFilter === item.key
          const count =
            item.key === 'All'
              ? templates.length
              : templates.filter((t) => {
                  const c = parseTemplateChannel(t.name, t.channel).channel
                  return c === item.key || c === 'All'
                }).length

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setChannelFilter(item.key as 'All' | TemplateChannel)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.775rem',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid',
                borderColor: isSelected ? 'var(--primary)' : '#e2e8f0',
                backgroundColor: isSelected ? 'var(--primary)' : '#ffffff',
                color: isSelected ? '#ffffff' : '#334155',
                boxShadow: isSelected ? '0 1px 3px rgba(79, 70, 229, 0.25)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                cursor: 'pointer',
                transform: 'none',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                boxSizing: 'border-box',
              }}
            >
              <span>{item.label}</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '0.1rem 0.45rem',
                  minWidth: '1.25rem',
                  textAlign: 'center',
                  borderRadius: '9999px',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
                  color: isSelected ? '#ffffff' : '#475569',
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="card text-center" style={{ padding: '3.5rem 2rem', borderRadius: '12px' }}>
          <FileText size={44} style={{ color: 'var(--primary)', margin: '0 auto 1rem', opacity: 0.8 }} />
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>
            No matching templates found
          </h2>
          <p className="text-muted" style={{ maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: '0.85rem' }}>
            Try selecting another Cadence Step or Channel filter, or create a new template for this step.
          </p>
          <button
            onClick={handleOpenCreate}
            className="btn btn-primary btn-sm"
            style={{ padding: '0.45rem 1.15rem' }}
          >
            + Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2" style={{ gap: '1rem', alignItems: 'stretch' }}>
          {filteredTemplates.map((template) => {
            const isCopied = copiedId === template.id
            const usedVariables = getUsedVariables(template)
            const parsed = parseTemplateChannel(template.name, template.channel)
            const templateStep = parseTemplateStep(template.name, template.step)
            const stepInfo = CADENCE_STEPS[templateStep]

            return (
              <div
                key={template.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.15rem 1.35rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  gap: '0.85rem',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  minHeight: '100%',
                }}
              >
                {/* Card Header: Icon + Title & Actions (Stable, no wrapping of actions) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '9999px',
                        backgroundColor: '#eff6ff',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid #bfdbfe',
                        marginTop: '2px',
                      }}
                    >
                      <FileText size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h3
                          className="font-semibold"
                          style={{
                            fontSize: '0.975rem',
                            margin: 0,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}
                          title={parsed.cleanName}
                        >
                          {parsed.cleanName}
                        </h3>
                        {renderChannelBadge(parsed.channel)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>
                          {stepInfo.shortLabel} • {stepInfo.timing}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                          • {stepInfo.visibilityRule}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Copy, Edit, Delete (Pinned, flexShrink: 0) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, marginTop: '2px' }}>
                    <button
                      onClick={() => copyTemplate(template)}
                      className={`btn btn-sm ${isCopied ? 'btn-success' : 'btn-secondary'}`}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '7px',
                        fontSize: '0.775rem',
                        gap: '5px',
                        height: '32px',
                      }}
                      title="Copy resolved template to clipboard"
                    >
                      {isCopied ? (
                        <>
                          <Check size={13} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(template)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '7px',
                        fontSize: '0.775rem',
                        color: '#475569',
                        height: '32px',
                      }}
                      title="Edit this template"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      onClick={() => setDeleteTarget(template)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '7px',
                        fontSize: '0.775rem',
                        color: '#dc2626',
                        height: '32px',
                      }}
                      title="Delete this template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Used Dynamic Variables Indicator */}
                {usedVariables.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                      Variables used:
                    </span>
                    {usedVariables.map((v) => (
                      <span
                        key={v}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: 'transparent',
                          color: '#0284c7',
                          border: 'none',
                          padding: 0,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                        }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Subject Line Preview */}
                {template.subject && (
                  <div>
                    <div
                      className="text-muted"
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.35rem',
                      }}
                    >
                      Subject Line Preview
                    </div>
                    <div
                      style={{
                        padding: '0.6rem 0.85rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '7px',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        color: '#0f172a',
                      }}
                    >
                      {renderInterpolatedText(template.subject)}
                    </div>
                  </div>
                )}

                {/* Body Content Preview (with proper newline breaks) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div
                    className="text-muted"
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Message Body Preview
                  </div>
                  <div
                    style={{
                      fontSize: '0.825rem',
                      whiteSpace: 'pre-wrap',
                      backgroundColor: '#f8fafc',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      color: '#1e293b',
                      lineHeight: 1.6,
                      flex: 1,
                    }}
                  >
                    {renderInterpolatedText(template.body)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Template Modal */}
      {modalOpen && (
        <TemplateModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setEditingTemplate(null)
          }}
          onSave={handleSaveTemplate}
          initialTemplate={editingTemplate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Template"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This template will be removed from your outreach library.`}
          confirmText="Delete Template"
          variant="danger"
        />
      )}
    </div>
  )
}
