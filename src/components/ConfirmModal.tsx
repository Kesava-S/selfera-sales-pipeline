'use client'

import React, { useEffect } from 'react'
import { RotateCcw, AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary' | 'warning'
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
}: ConfirmModalProps) {
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

  const isDanger = variant === 'danger'
  const isWarning = variant === 'warning'

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
        padding: '1.5rem',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '1.75rem 2rem',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '11px',
              backgroundColor: isDanger ? '#fef2f2' : isWarning ? '#fffbeb' : '#eef2ff',
              color: isDanger ? 'var(--danger)' : isWarning ? '#d97706' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isDanger || isWarning ? <AlertTriangle size={20} /> : <RotateCcw size={20} />}
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            {title}
          </h3>
        </div>

        {/* Modal Description */}
        <p
          style={{
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: '#475569',
            marginBottom: '1.75rem',
          }}
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '0.55rem 1.15rem',
              fontSize: '0.85rem',
              borderRadius: '8px',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            style={{
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <RotateCcw size={14} />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
