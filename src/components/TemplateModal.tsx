'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  FileText,
  X,
  Layers,
  Eye,
  Check,
  AlertCircle,
  MessageCircle,
  Mail,
  Phone,
} from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/Icons'
import { Template, TemplateChannel, CadenceStep } from '@/types/database'
import {
  parseTemplateChannel,
  formatTemplateNameWithChannel,
  CADENCE_STEPS,
  parseTemplateStep,
  sanitizeTemplateInput,
  sanitizeVariableName,
  cleanTemplateText,
} from '@/lib/templateUtils'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (templateData: {
    id?: string
    name: string
    subject: string | null
    body: string
    channel?: TemplateChannel
    step?: CadenceStep | null
  }) => Promise<void>
  initialTemplate?: Template | null
}

interface VariableItem {
  key: string
  label: string
  example: string
  isCustom?: boolean
}

const SYSTEM_VARIABLES: VariableItem[] = [
  { key: '{business_name}', label: 'Business Name', example: 'Business Name' },
  { key: '{contact_name}', label: 'Contact Name', example: 'Contact Name' },
  { key: '{channel}', label: 'Channel', example: 'WhatsApp' },
  { key: '{email}', label: 'Email', example: 'contact@company.com' },
  { key: '{phone}', label: 'Phone', example: '+44 7700 900123' },
  { key: '{lead_code}', label: 'Lead ID', example: 'LD-1001' },
  { key: '{sender_name}', label: 'Sender Name', example: 'Sales Team' },
]

const CHANNELS: {
  key: TemplateChannel
  label: string
  icon: React.ReactNode
  color: string
  bg: string
  border: string
}[] = [
  { key: 'All', label: 'All Channels', icon: <Layers size={14} />, color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  { key: 'WhatsApp', label: 'WhatsApp', icon: <MessageCircle size={14} />, color: '#16a34a', bg: '#ecfdf5', border: '#a7f3d0' },
  { key: 'Instagram', label: 'Instagram', icon: <InstagramIcon size={14} />, color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  { key: 'SMS', label: 'SMS / Text', icon: <Phone size={14} />, color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { key: 'Facebook', label: 'Facebook', icon: <FacebookIcon size={14} />, color: '#1877f2', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'Email', label: 'Email', icon: <Mail size={14} />, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
]

export function TemplateModal({
  isOpen,
  onClose,
  onSave,
  initialTemplate = null,
}: TemplateModalProps) {
  const [name, setName] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<TemplateChannel>('All')
  const [selectedStep, setSelectedStep] = useState<CadenceStep>(0)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [customVariables, setCustomVariables] = useState<VariableItem[]>([])
  const [newVarName, setNewVarName] = useState('')
  const [showAddVarInput, setShowAddVarInput] = useState(false)
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveLead, setLiveLead] = useState<{
    business_name?: string
    channel?: string
    email?: string
    phone?: string
    lead_code?: string
  } | null>(null)

  const subjectInputRef = useRef<HTMLInputElement>(null)
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const fetchLead = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('leads')
          .select('business_name, email, phone, channel, lead_code')
          .order('created_at', { ascending: false })
          .limit(1)
        if (data && data[0]) {
          setLiveLead(data[0])
        }
      } catch {
        // ignore
      }
    }
    fetchLead()
  }, [isOpen])

  const allVariables = useMemo(() => {
    const sysVars: VariableItem[] = [
      { key: '{business_name}', label: 'Business Name', example: liveLead?.business_name || 'Business Name' },
      { key: '{contact_name}', label: 'Contact Name', example: liveLead?.business_name || 'Contact Name' },
      { key: '{channel}', label: 'Channel', example: selectedChannel !== 'All' ? selectedChannel : (liveLead?.channel || 'WhatsApp') },
      { key: '{email}', label: 'Email', example: liveLead?.email || 'contact@company.com' },
      { key: '{phone}', label: 'Phone', example: liveLead?.phone || '+44 7700 900123' },
      { key: '{lead_code}', label: 'Lead ID', example: liveLead?.lead_code || 'LD-1001' },
      { key: '{sender_name}', label: 'Sender Name', example: 'Sales Team' },
    ]
    return [...sysVars, ...customVariables]
  }, [customVariables, liveLead, selectedChannel])

  useEffect(() => {
    if (initialTemplate) {
      const parsed = parseTemplateChannel(initialTemplate.name || '', initialTemplate.channel)
      setName(parsed.cleanName)
      setSelectedChannel(parsed.channel)
      setSelectedStep(parseTemplateStep(initialTemplate.name || '', initialTemplate.step))
      setSubject(sanitizeTemplateInput(initialTemplate.subject || ''))
      const cleanBody = sanitizeTemplateInput(initialTemplate.body || '')
      setBody(cleanBody)

      // Detect any custom variables already present in template
      const combined = `${initialTemplate.subject || ''} ${cleanBody}`
      const matches = combined.match(/\{([a-zA-Z0-9_-]+)\}/g) || []
      const detected = Array.from(new Set(matches))
        .filter((k) => !SYSTEM_VARIABLES.some((sv) => sv.key === k))
        .map((k) => {
          const varName = k.slice(1, -1)
          const formattedLabel = varName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          return {
            key: k,
            label: formattedLabel,
            example: formattedLabel,
            isCustom: true,
          }
        })
      setCustomVariables(detected)
    } else {
      setName('')
      setSelectedChannel('All')
      setSelectedStep(0)
      setSubject('')
      setBody('')
      setCustomVariables([])
    }
    setActiveTab('editor')
    setShowAddVarInput(false)
    setNewVarName('')
    setError(null)
  }, [initialTemplate, isOpen])

  if (!isOpen) return null

  const isEditing = Boolean(initialTemplate?.id)

  const handleAddCustomVariable = () => {
    const clean = sanitizeVariableName(newVarName.trim())
    if (!clean) return
    const key = `{${clean}}`
    const exists = allVariables.some((v: VariableItem) => v.key.toLowerCase() === key.toLowerCase())
    if (!exists) {
      const formattedLabel = clean
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
      setCustomVariables((prev) => [
        ...prev,
        {
          key,
          label: formattedLabel,
          example: formattedLabel,
          isCustom: true,
        },
      ])
    }
    setNewVarName('')
    setShowAddVarInput(false)
  }

  const handleRemoveCustomVariable = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCustomVariables((prev) => prev.filter((v) => v.key !== key))
  }

  const insertVariableIntoSubject = (variableKey: string) => {
    const input = subjectInputRef.current
    if (!input) {
      setSubject((prev) => sanitizeTemplateInput(prev + variableKey))
      return
    }

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const textBefore = subject.substring(0, start)
    const textAfter = subject.substring(end)
    const updated = sanitizeTemplateInput(textBefore + variableKey + textAfter)
    setSubject(updated)

    setTimeout(() => {
      input.focus()
      const newCursorPos = start + variableKey.length
      input.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const insertVariableIntoBody = (variableKey: string) => {
    const textarea = bodyTextareaRef.current
    if (!textarea) {
      setBody((prev) => sanitizeTemplateInput(prev + variableKey))
      return
    }

    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const textBefore = body.substring(0, start)
    const textAfter = body.substring(end)
    const updated = sanitizeTemplateInput(textBefore + variableKey + textAfter)
    setBody(updated)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + variableKey.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const getPreviewText = (text: string) => {
    let result = sanitizeTemplateInput(text)
    allVariables.forEach((v: VariableItem) => {
      result = result.split(v.key).join(v.example)
    })
    return result
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a name for this template.')
      return
    }
    if (!body.trim()) {
      setError('Template body cannot be empty.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSave({
        id: initialTemplate?.id,
        name: formatTemplateNameWithChannel(name.trim(), selectedChannel),
        subject: subject.trim() ? sanitizeTemplateInput(subject.trim()) : null,
        body: sanitizeTemplateInput(body.trim()),
        channel: selectedChannel,
        step: selectedStep,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save template'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e2e8f0',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
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
              <FileText size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {isEditing ? 'Edit Outreach Template' : 'Create New Outreach Template'}
              </h2>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                Insert dynamic placeholders that auto-populate with lead data.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle: Editor vs Live Preview */}
        <div
          style={{
            padding: '0.5rem 1.5rem',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`btn btn-sm ${activeTab === 'editor' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.775rem', borderRadius: '7px' }}
          >
            Template Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`btn btn-sm ${activeTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.775rem', borderRadius: '7px', gap: '5px' }}
          >
            <Eye size={13} />
            <span>Sample Preview</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1.35rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.65rem 0.95rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '0.825rem',
                marginBottom: '1rem',
              }}
            >
              <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'editor' ? (
            <form id="template-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Template Name */}
              <div>
                <label className="input-label" style={{ fontSize: '0.825rem', marginBottom: '0.35rem', display: 'block' }}>
                  Template Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. First Outreach (Day 0), WhatsApp Quick Intro"
                  className="input-field"
                  style={{ fontSize: '0.875rem', padding: '0.55rem 0.85rem', borderRadius: '8px' }}
                  required
                />
              </div>

              {/* Target Channel / Source Selector */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <label className="input-label" style={{ fontSize: '0.825rem', margin: 0 }}>
                    Target Channel / Source <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Choose which platform this template is intended for
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {CHANNELS.map((ch) => {
                    const isSelected = selectedChannel === ch.key
                    return (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => setSelectedChannel(ch.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${ch.color}` : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? ch.bg : '#ffffff',
                          color: isSelected ? ch.color : '#475569',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', color: ch.color }}>{ch.icon}</span>
                        <span style={{ flex: 1, textAlign: 'left' }}>{ch.label}</span>
                        {isSelected && <Check size={13} strokeWidth={3} style={{ color: ch.color }} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Cadence Step Selector */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <label className="input-label" style={{ fontSize: '0.825rem', margin: 0 }}>
                    Cadence Step / Stage <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Determines which outreach step unlocks this template
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {([0, 1, 2, 3] as CadenceStep[]).map((stepNum) => {
                    const info = CADENCE_STEPS[stepNum]
                    const isSelected = selectedStep === stepNum
                    return (
                      <button
                        key={stepNum}
                        type="button"
                        onClick={() => setSelectedStep(stepNum)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          color: isSelected ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          gap: '2px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontSize: '0.785rem', fontWeight: 700 }}>
                            {info.shortLabel}
                          </span>
                          {isSelected && <Check size={13} strokeWidth={3} style={{ color: '#2563eb' }} />}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: isSelected ? '#1e40af' : '#64748b' }}>
                          {info.timing}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: isSelected ? '#3b82f6' : '#94a3b8' }}>
                          {info.visibilityRule}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Subject Line */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="input-label" style={{ fontSize: '0.825rem', margin: 0 }}>
                    Subject Line (Email / Header)
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Optional</span>
                </div>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(sanitizeTemplateInput(e.target.value))}
                  placeholder="e.g. Quick question regarding operations at {business_name}"
                  className="input-field"
                  style={{ fontSize: '0.875rem', padding: '0.55rem 0.85rem', borderRadius: '8px', marginBottom: '0.4rem' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginRight: '4px' }}>
                    Insert in Subject:
                  </span>
                  {allVariables.slice(0, 5).map((v: VariableItem) => (
                    <button
                      key={`subj-${v.key}`}
                      type="button"
                      onClick={() => insertVariableIntoSubject(v.key)}
                      style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        padding: '0.12rem 0.45rem',
                        borderRadius: '5px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + {v.key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Variable Chips for Body */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FileText size={14} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.785rem', fontWeight: 700, color: '#334155' }}>
                      Click variable to insert into Body:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddVarInput((prev) => !prev)}
                    className="btn btn-sm btn-secondary"
                    style={{
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.725rem',
                      borderRadius: '6px',
                      color: 'var(--primary)',
                      borderColor: '#bfdbfe',
                      backgroundColor: showAddVarInput ? '#eff6ff' : '#ffffff',
                    }}
                  >
                    + Add Custom Variable
                  </button>
                </div>

                {/* Inline Custom Variable Creator */}
                {showAddVarInput && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      animation: 'fadeIn 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <input
                        type="text"
                        value={newVarName}
                        onChange={(e) => setNewVarName(sanitizeVariableName(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCustomVariable()
                          }
                        }}
                        placeholder="Variable name (e.g. meeting_link, discount_code)"
                        className="input-field"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          flex: 1,
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomVariable}
                        disabled={!newVarName.trim()}
                        className="btn btn-primary btn-sm"
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddVarInput(false)
                          setNewVarName('')
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Allowed: only letters, numbers, and underscores (no special characters). Creates <code>&#123;{newVarName || 'variable_name'}&#125;</code>.
                    </span>
                  </div>
                )}

                {/* Chips Grid */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {allVariables.map((v: VariableItem) => (
                    <div
                      key={v.key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: v.isCustom ? '#c7d2fe' : '#cbd5e1',
                        backgroundColor: v.isCustom ? '#eef2ff' : '#ffffff',
                        overflow: 'hidden',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => insertVariableIntoBody(v.key)}
                        title={`Click to insert ${v.key} into body`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: v.isCustom ? '#4338ca' : 'var(--primary)',
                          padding: '0.22rem 0.55rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ color: v.isCustom ? '#6366f1' : '#0284c7' }}>+</span>
                        <code>{v.key}</code>
                      </button>
                      {v.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveCustomVariable(v.key, e)}
                          title={`Remove ${v.key}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            borderLeft: '1px solid #c7d2fe',
                            color: '#6366f1',
                            padding: '0.22rem 0.35rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Template Body */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="input-label" style={{ fontSize: '0.825rem', margin: 0 }}>
                    Template Body <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Press Enter for line breaks
                  </span>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  value={body}
                  onChange={(e) => setBody(sanitizeTemplateInput(e.target.value))}
                  placeholder={`Hi {contact_name},

I noticed the great work {business_name} is doing and wanted to see if you would be open to a quick chat...`}
                  className="input-field"
                  rows={8}
                  style={{
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    padding: '0.75rem 0.95rem',
                    borderRadius: '8px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                  required
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Special characters like backslashes (\) and HTML brackets (&lt;, &gt;) are blocked. Real line breaks and &#123;variables&#125; are supported.
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {body.length} characters
                  </span>
                </div>
              </div>
            </form>
          ) : (
            /* Live Sample Preview Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '9px',
                  fontSize: '0.8rem',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <strong>Live Demonstration:</strong> Showing resolved template preview{liveLead?.business_name ? <> for prospective lead <em>{liveLead.business_name}</em></> : ''}.
                </div>
                <span
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #bae6fd',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#0284c7',
                  }}
                >
                  Channel: {selectedChannel}
                </span>
              </div>

              {subject && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Resolved Subject Line
                  </div>
                  <div
                    style={{
                      padding: '0.7rem 0.95rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  >
                    {getPreviewText(subject)}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Resolved Message Body
                </div>
                <div
                  style={{
                    padding: '1rem 1.15rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    lineHeight: 1.65,
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {getPreviewText(body) || <span className="text-muted">No body content typed yet.</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', borderRadius: '8px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e)}
            disabled={isSubmitting}
            className="btn btn-primary btn-sm"
            style={{ padding: '0.45rem 1.2rem', fontSize: '0.8125rem', borderRadius: '8px', gap: '6px' }}
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check size={14} />
                <span>{isEditing ? 'Save Changes' : 'Create Template'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
