'use client'

import React, { useMemo, useState } from 'react'
import {
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Zap,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react'
import type { ChannelIntegration } from './types'
import { ChannelIcon } from './IntegrationIcons'
import { testIntegrationAction } from '@/app/dashboard/actions'
import { toast, useScrollLock } from '@/components/ui'

interface IntegrationConfigModalProps {
  channel: ChannelIntegration | null
  open: boolean
  onClose: () => void
  onSave: (id: string, updatedConfig: Record<string, any>) => void
}

export function IntegrationConfigModal({
  channel,
  open,
  onClose,
  onSave,
}: IntegrationConfigModalProps) {
  useScrollLock(open && !!channel)
  if (!open || !channel) return null

  const [formData, setFormData] = useState<Record<string, any>>({ ...channel.config })
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [testing, setTesting] = useState(false)
  const [newTemplateInput, setNewTemplateInput] = useState('')

  const templatesList: string[] = useMemo(() => {
    const raw = formData.templates
    if (Array.isArray(raw)) return raw.filter(Boolean)
    if (typeof raw === 'string') return raw.split(',').map((s: string) => s.trim()).filter(Boolean)
    const fallback = formData.default_template_name || 'selfera_sales_pipeline_general'
    return [fallback]
  }, [formData.templates, formData.default_template_name])

  // Active email provider for dynamic field switching
  const activeEmailProvider = useMemo(() => {
    if (channel.id !== 'email') return null
    return formData.provider || 'resend'
  }, [channel.id, formData.provider])

  // Dynamic active fields filtered by provider
  const activeFields = useMemo(() => {
    if (channel.id !== 'email') return channel.fields
    return channel.fields.filter(f => {
      if (f.key === 'provider' || f.key === 'from_name' || f.key === 'from_email' || f.key === 'reply_to') {
        return true
      }
      if (activeEmailProvider === 'resend') {
        return f.key === 'resend_api_key' || f.key === 'resend_webhook_secret'
      } else {
        return [
          'smtp_host',
          'smtp_port',
          'smtp_user',
          'smtp_pass',
          'imap_host',
          'imap_port',
          'imap_user',
          'imap_pass',
        ].includes(f.key)
      }
    })
  }, [channel.id, channel.fields, activeEmailProvider])

  const handleAddTemplate = () => {
    const clean = newTemplateInput.trim().toLowerCase().replace(/\s+/g, '_')
    if (!clean) return
    if (templatesList.includes(clean)) {
      toast.error('Template is already in the list')
      return
    }
    const nextList = [...templatesList, clean]
    handleChange('templates', nextList)
    setNewTemplateInput('')
    toast.success(`Added template: ${clean}`)
  }

  const handleRemoveTemplate = (templateToRemove: string) => {
    const nextList = templatesList.filter(t => t !== templateToRemove)
    handleChange('templates', nextList)
    if (formData.default_template_name === templateToRemove) {
      handleChange('default_template_name', nextList[0] || 'selfera_sales_pipeline_general')
    }
  }

  const handleSetDefaultTemplate = (templateName: string) => {
    handleChange('default_template_name', templateName)
    toast.success(`Set "${templateName}" as default WhatsApp template`)
  }

  const toggleReveal = (key: string) => {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const copyWebhook = () => {
    if (!channel.webhookUrl) return
    const url = channel.webhookUrl.startsWith('http')
      ? channel.webhookUrl
      : typeof window !== 'undefined'
      ? `${window.location.origin}${channel.webhookUrl}`
      : channel.webhookUrl
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Webhook URL copied')
  }

  const handleChange = (key: string, val: any) => {
    setFormData(prev => ({ ...prev, [key]: val }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(channel.id, formData)
    toast.success(`${channel.name} configuration saved`)
    onClose()
  }

  const handleTest = async () => {
    setTesting(true)
    const res = await testIntegrationAction(channel.id)
    setTesting(false)

    if (res.ok) {
      toast.success(res.data?.message || `${channel.name} connected successfully`)
    } else {
      toast.error(res.error || `${channel.name} test failed`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
              <ChannelIcon id={channel.id} size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-none">
                {channel.name}
              </h2>
              <span className="text-[11px] text-slate-400">
                {channel.provider}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
            {/* Webhook URL (if applicable) */}
            {channel.webhookUrl && (channel.id !== 'email' || activeEmailProvider === 'resend') && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Webhook URL
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={
                      channel.webhookUrl?.startsWith('http')
                        ? channel.webhookUrl
                        : typeof window !== 'undefined'
                        ? `${window.location.origin}${channel.webhookUrl}`
                        : channel.webhookUrl
                    }
                    className="input !py-1.5 text-xs font-mono bg-slate-50 select-all"
                  />
                  <button
                    type="button"
                    onClick={copyWebhook}
                    className="btn btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1 shrink-0"
                    title="Copy URL"
                  >
                    {copied ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <Copy size={12} />
                    )}
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            )}

            {/* Inputs */}
            {activeFields.map(f => {
              const isPassword = f.type === 'password'
              const isRevealed = revealed[f.key]
              const val = formData[f.key] ?? (f.key === 'provider' ? 'smtp' : '')

              const isSectionHeader =
                channel.id === 'email' &&
                (f.key === 'smtp_host' || f.key === 'imap_host' || f.key === 'from_name' || f.key === 'resend_api_key')

              const sectionTitle =
                f.key === 'smtp_host'
                  ? 'Outgoing Send Server (SMTP)'
                  : f.key === 'imap_host'
                  ? 'Incoming Reply Tracking (IMAP)'
                  : f.key === 'resend_api_key'
                  ? 'Cloud Gateway Credentials (Resend)'
                  : f.key === 'from_name'
                  ? 'Sender Identity & Routing'
                  : null

              if (f.type === 'select') {
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                      {f.label}
                    </label>
                    <select
                      className="input !py-1.5 text-xs bg-white"
                      value={val || 'smtp'}
                      onChange={e => handleChange(f.key, e.target.value)}
                    >
                      {f.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              }

              return (
                <React.Fragment key={f.key}>
                  {isSectionHeader && sectionTitle && (
                    <div className="pt-2.5 pb-0.5 border-t border-slate-100 first:border-t-0">
                      <span className="text-[11px] font-bold text-slate-800 tracking-wide uppercase">
                        {sectionTitle}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">
                      {f.label}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={isPassword && !isRevealed ? 'password' : 'text'}
                        className="input !py-1.5 pr-8 text-xs font-mono"
                        placeholder={f.placeholder}
                        value={val}
                        onChange={e => handleChange(f.key, e.target.value)}
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(f.key)}
                          className="absolute right-2 p-1 text-slate-400 hover:text-slate-600"
                          title={isRevealed ? 'Hide' : 'Show'}
                        >
                          {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              )
            })}

            {/* WhatsApp Approved Message Templates */}
            {channel.id === 'whatsapp' && (
              <div className="space-y-2 pt-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    Approved Message Templates
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {templatesList.length} configured
                  </span>
                </div>

                {/* Add template input row */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newTemplateInput}
                    onChange={e => setNewTemplateInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddTemplate()
                      }
                    }}
                    placeholder="e.g. selfera_sales_followup_1"
                    className="input !py-1 text-xs font-mono flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddTemplate}
                    disabled={!newTemplateInput.trim()}
                    className="btn btn-secondary !py-1 !px-2.5 text-xs inline-flex items-center gap-1 shrink-0"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>

                {/* List of templates */}
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {templatesList.map(tpl => {
                    const isDefault = (formData.default_template_name || 'selfera_sales_pipeline_general') === tpl
                    return (
                      <div
                        key={tpl}
                        className="flex items-center justify-between p-1.5 px-2.5 bg-slate-50 border border-slate-200/80 rounded-md text-xs font-mono text-slate-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{tpl}</span>
                          {isDefault ? (
                            <span className="text-[10px] font-sans font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                              Default
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultTemplate(tpl)}
                              className="text-[10px] font-sans text-slate-400 hover:text-primary transition-colors underline"
                            >
                              Set as default
                            </button>
                          )}
                        </div>
                        {templatesList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTemplate(tpl)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 ml-2 shrink-0"
                            title="Remove template"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="btn btn-secondary !py-1 !px-2.5 text-xs inline-flex items-center gap-1.5"
            >
              {testing ? (
                <RefreshCw size={12} className="animate-spin text-primary" />
              ) : (
                <Zap size={12} className="text-amber-500" />
              )}
              <span>{testing ? 'Testing...' : 'Test'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary !py-1 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary !py-1 text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
