'use client'

import React, { useEffect, useState } from 'react'
import {
  MessageCircle,
  Mail,
  Phone,
  Check,
  X,
  ThumbsUp,
  UserCheck,
  ArrowRight,
} from 'lucide-react'
import { InstagramIcon } from '@/components/Icons'
import type { ExtendedLead, ChannelType } from '@/types/database'

interface ReplyChannelOption {
  channel: ChannelType
  label: string
  detail: string
  icon: React.ReactNode
  bg: string
  color: string
  borderColor: string
}

interface ReplyChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedChannel: ChannelType, note?: string) => void
  lead: ExtendedLead
  actionType: 'replied' | 'interested'
}

export function ReplyChannelModal({
  isOpen,
  onClose,
  onConfirm,
  lead,
  actionType,
}: ReplyChannelModalProps) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>(lead.channel)
  const [note, setNote] = useState<string>('')

  // Build available channel options based on lead data
  const options: ReplyChannelOption[] = []

  if (lead.phone) {
    options.push({
      channel: 'WhatsApp',
      label: 'WhatsApp',
      detail: lead.phone,
      icon: <MessageCircle size={20} />,
      bg: '#f0fdf4',
      color: '#16a34a',
      borderColor: '#bbf7d0',
    })
  }

  if (lead.email) {
    options.push({
      channel: 'Email',
      label: 'Email',
      detail: lead.email,
      icon: <Mail size={20} />,
      bg: '#eff6ff',
      color: '#2563eb',
      borderColor: '#bfdbfe',
    })
  }

  if (lead.instagram_handle) {
    options.push({
      channel: 'Instagram',
      label: 'Instagram DM',
      detail: `@${lead.instagram_handle.replace('@', '')}`,
      icon: <InstagramIcon size={20} />,
      bg: '#fdf2f8',
      color: '#db2777',
      borderColor: '#fbcfe8',
    })
  }

  if (lead.phone) {
    options.push({
      channel: 'Phone',
      label: 'Phone Call / SMS',
      detail: lead.phone,
      icon: <Phone size={20} />,
      bg: '#f8fafc',
      color: '#475569',
      borderColor: '#cbd5e1',
    })
  }

  // Ensure current lead channel is in options or default to first
  useEffect(() => {
    if (isOpen) {
      if (options.some((o) => o.channel === lead.channel)) {
        setSelectedChannel(lead.channel)
      } else if (options.length > 0) {
        setSelectedChannel(options[0].channel)
      }
      setNote('')
    }
  }, [isOpen, lead.channel])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isInterested = actionType === 'interested'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '2rem',
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
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
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: isInterested ? '#fff7ed' : '#f5f3ff',
              color: isInterested ? '#c2410c' : '#6d28d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isInterested ? <ThumbsUp size={22} /> : <UserCheck size={22} />}
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {isInterested ? 'Record Prospect Interest' : 'Record Client Reply'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              For <strong>{lead.business_name}</strong>
            </p>
          </div>
        </div>

        {/* Subtitle / Explanation */}
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '0.825rem',
            color: '#475569',
            lineHeight: 1.55,
            marginBottom: '1.25rem',
          }}
        >
          {isInterested ? (
            <>
              Which channel did they show interest on? Future follow-ups and the <strong>+2 working days</strong> proposal reminder will be targeted to this channel.
            </>
          ) : (
            <>
              Which channel did they respond on? Cold outreach on other sources will stop, and future follow-ups will switch to this channel.
            </>
          )}
        </div>

        {/* Channel Selection List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.775rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
            Select Reply Channel:
          </span>
          {options.map((opt) => {
            const isSelected = selectedChannel === opt.channel
            const isPrimary = lead.channel === opt.channel
            return (
              <div
                key={opt.channel}
                onClick={() => setSelectedChannel(opt.channel)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? '#f5f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: opt.bg,
                      color: opt.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {opt.icon}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.925rem', color: '#0f172a' }}>
                        {opt.label}
                      </span>
                      {isPrimary && (
                        <span
                          style={{
                            fontSize: '0.675rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.45rem',
                            backgroundColor: '#e2e8f0',
                            color: '#475569',
                            borderRadius: '4px',
                          }}
                        >
                          Current Primary
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{opt.detail}</span>
                  </div>
                </div>

                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    border: isSelected ? '2px solid var(--primary)' : '2px solid #cbd5e1',
                    backgroundColor: isSelected ? 'var(--primary)' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  {isSelected && <Check size={13} strokeWidth={3} />}
                </div>
              </div>
            )
          })}
        </div>

        {/* Optional Note / Takeaway */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.775rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#64748b',
              letterSpacing: '0.05em',
              marginBottom: '0.45rem',
            }}
          >
            Interaction Note (Optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Asked for pricing deck; wants demo this Thursday..."
            className="input-field"
            style={{
              width: '100%',
              padding: '0.65rem 0.95rem',
              fontSize: '0.875rem',
              borderRadius: '8px',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '0.6rem 1.25rem',
              fontSize: '0.875rem',
              borderRadius: '10px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(selectedChannel, note.trim() || undefined)
              onClose()
            }}
            className="btn btn-primary"
            style={{
              padding: '0.6rem 1.45rem',
              fontSize: '0.875rem',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Confirm &amp; Switch Channel</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
