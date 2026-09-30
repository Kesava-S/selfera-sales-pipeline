'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Layers,
  Globe,
  LayoutDashboard,
  Cpu,
  Workflow,
  Send,
  Sparkles,
  Shield,
  Zap,
  Rocket,
  Target,
  Server,
  Code,
  Check,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react'
import type { ServiceItem } from '@/types/database'
import { ServiceIcon } from '@/components/ServiceBadge'

const AVAILABLE_ICONS = [
  'Globe',
  'LayoutDashboard',
  'Cpu',
  'Workflow',
  'Send',
  'Layers',
  'Sparkles',
  'Shield',
  'Zap',
  'Rocket',
  'Target',
  'Server',
  'Code',
]

const COLOR_PALETTE = [
  { label: 'Blue', value: '#2563eb' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Cyan', value: '#0284c7' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Slate', value: '#475569' },
]

export interface ServiceModalProps {
  isOpen: boolean
  serviceToEdit?: ServiceItem | null
  existingNames?: string[]
  onClose: () => void
  onSave: (service: {
    id?: string
    name: string
    description: string
    icon_name: string
    color: string
    deliverables: string[]
    is_active: boolean
  }) => Promise<void>
}

export function ServiceModal({
  isOpen,
  serviceToEdit,
  existingNames = [],
  onClose,
  onSave,
}: ServiceModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconName, setIconName] = useState('Layers')
  const [color, setColor] = useState('#2563eb')
  const [deliverables, setDeliverables] = useState<string[]>([])
  const [newDeliverable, setNewDeliverable] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (serviceToEdit) {
      setName(serviceToEdit.name || '')
      setDescription(serviceToEdit.description || '')
      setIconName(serviceToEdit.icon_name || 'Layers')
      setColor(serviceToEdit.color || '#2563eb')
      setDeliverables(
        Array.isArray(serviceToEdit.deliverables) ? serviceToEdit.deliverables : []
      )
      setIsActive(serviceToEdit.is_active !== false)
    } else {
      setName('')
      setDescription('')
      setIconName('Layers')
      setColor('#2563eb')
      setDeliverables([])
      setIsActive(true)
    }
    setErrorMsg(null)
    setNewDeliverable('')
  }, [serviceToEdit, isOpen])

  if (!isOpen) return null

  const handleAddDeliverable = () => {
    const trimmed = newDeliverable.trim()
    if (!trimmed) return
    if (!deliverables.includes(trimmed)) {
      setDeliverables([...deliverables, trimmed])
    }
    setNewDeliverable('')
  }

  const handleRemoveDeliverable = (index: number) => {
    setDeliverables(deliverables.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Service name is required.')
      return
    }

    // Check duplicate name if creating or changing name
    const isEditingCurrent = serviceToEdit && serviceToEdit.name.toLowerCase() === cleanName.toLowerCase()
    if (!isEditingCurrent && existingNames.some((n) => n.toLowerCase() === cleanName.toLowerCase())) {
      setErrorMsg(`A service named "${cleanName}" already exists.`)
      return
    }

    if (!description.trim()) {
      setErrorMsg('Service description is required.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        id: serviceToEdit?.id,
        name: cleanName,
        description: description.trim(),
        icon_name: iconName,
        color,
        deliverables,
        is_active: isActive,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save service'
      setErrorMsg(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !mounted) return null

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
          maxWidth: '580px',
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
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
            padding: '1.2rem 1.5rem',
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
                borderRadius: '9px',
                backgroundColor: `${color}15`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${color}30`,
              }}
            >
              <ServiceIcon name={iconName} size={18} color={color} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {serviceToEdit ? 'Edit Service Offering' : 'Create New Service Offering'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                {serviceToEdit ? `Updating commercial parameters for ${serviceToEdit.name}` : 'Add a new client deliverable to your sales pipeline'}
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

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent',
          }}
        >
          {errorMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Service Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
              Service Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Workflow Automation, Mobile App Design"
              className="input-field"
              style={{ width: '100%', borderRadius: '8px', fontSize: '0.875rem' }}
            />
          </div>

          {/* Icon Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.45rem' }}>
              Select Icon
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {AVAILABLE_ICONS.map((ic) => {
                const isSelected = iconName === ic
                return (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIconName(ic)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '8px',
                      border: isSelected ? `2px solid ${color}` : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? `${color}15` : '#ffffff',
                      color: isSelected ? color : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={ic}
                  >
                    <ServiceIcon name={ic} size={18} color={isSelected ? color : '#64748b'} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.45rem' }}>
              Brand Theme Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {COLOR_PALETTE.map((c) => {
                const isSelected = color === c.value
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: c.value,
                      border: isSelected ? '3px solid #0f172a' : '2px solid #ffffff',
                      boxShadow: isSelected ? '0 0 0 1px #cbd5e1' : '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      transition: 'transform 0.1s ease',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                    }}
                    title={c.label}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
              Service Overview & Pitch <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the scope of work and what value it delivers to the client..."
              rows={3}
              className="input-field"
              style={{ width: '100%', borderRadius: '8px', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          {/* Key Deliverables */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
              Key Deliverables & Features
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <input
                type="text"
                value={newDeliverable}
                onChange={(e) => setNewDeliverable(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddDeliverable()
                  }
                }}
                placeholder="Add deliverable (e.g. Next.js app, CRM sync)"
                className="input-field"
                style={{ flex: 1, borderRadius: '8px', fontSize: '0.825rem' }}
              />
              <button
                type="button"
                onClick={handleAddDeliverable}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '8px', padding: '0 0.85rem' }}
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {deliverables.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {deliverables.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                      <span style={{ color: '#334155' }}>{item}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDeliverable(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                      className="hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', paddingTop: '0.35rem' }}>
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="isActiveCheck" style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500, cursor: 'pointer' }}>
              Active Offering (visible for new lead pitches & service pivots)
            </label>
          </div>
        </form>

        {/* Pinned Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: '1rem 1.5rem',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            backgroundColor: '#fafbfc',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '8px', padding: '0.5rem 1rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn btn-primary btn-sm"
            style={{ borderRadius: '8px', padding: '0.5rem 1.25rem', gap: '6px' }}
          >
            {isSubmitting ? 'Saving...' : serviceToEdit ? 'Save Changes' : 'Create Service'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
