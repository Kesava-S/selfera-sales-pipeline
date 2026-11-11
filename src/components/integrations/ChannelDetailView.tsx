'use client'

import React, { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Sliders,
  Zap,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Radio,
  Send,
  AlertCircle,
  FlaskConical,
  Activity,
  Layers,
} from 'lucide-react'
import type { ChannelIntegration, IntegrationEnvironment } from './types'
import { ChannelIcon } from './IntegrationIcons'
import {
  saveIntegrationAction,
  toggleIntegrationAction,
  testIntegrationAction,
  sendLiveTestChannelAction,
} from '@/app/dashboard/actions'
import { toast } from '@/components/ui'

interface ChannelDetailViewProps {
  channel: ChannelIntegration
  isAdmin?: boolean
}

export function ChannelDetailView({
  channel: initialChannel,
  isAdmin = true,
}: ChannelDetailViewProps) {
  const [channel, setChannel] = useState<ChannelIntegration>(initialChannel)
  const [activeEnv, setActiveEnv] = useState<IntegrationEnvironment>(
    (channel.config.environment as IntegrationEnvironment) || 'realtime'
  )
  const [formData, setFormData] = useState<Record<string, any>>({ ...channel.config })
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Testing states
  const [isHealthTesting, setIsHealthTesting] = useState(false)
  const [healthResult, setHealthResult] = useState<{
    ok: boolean
    message: string
    latencyMs?: number
  } | null>(null)

  // Live test console states
  const [testRecipient, setTestRecipient] = useState('')
  const [testMessage, setTestMessage] = useState(
    channel.id === 'whatsapp'
      ? 'This is a test message to verify WhatsApp integration.'
      : 'This is a test email to verify integration delivery.'
  )
  const [selectedTemplate, setSelectedTemplate] = useState(
    formData.default_template_name || ''
  )
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testSendResult, setTestSendResult] = useState<{
    ok: boolean
    messageId?: string | null
    latencyMs?: number
    error?: string
    timestamp?: string
  } | null>(null)

  // WhatsApp template addition state
  const [newTemplateInput, setNewTemplateInput] = useState('')

  const isConnected = channel.status === 'connected'

  const templatesList: string[] = useMemo(() => {
    const raw = formData.templates
    const list = Array.isArray(raw)
      ? raw.filter(Boolean)
      : typeof raw === 'string'
      ? raw.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [formData.default_template_name || 'selfera_sales_pipeline_general']

    if (channel.id === 'whatsapp' && !list.includes('hello_world')) {
      return [...list, 'hello_world']
    }
    return list
  }, [formData.templates, formData.default_template_name, channel.id])

  // Active email provider ('resend' | 'smtp')
  const activeEmailProvider = useMemo(() => {
    if (channel.id !== 'email') return null
    return activeEnv === 'sandbox'
      ? (formData.sandbox_provider || formData.provider || 'resend')
      : (formData.provider || 'resend')
  }, [channel.id, activeEnv, formData.sandbox_provider, formData.provider])

  // Filter fields dynamically based on active provider
  const activeFields = useMemo(() => {
    if (channel.id !== 'email') return channel.fields
    return channel.fields.filter(f => {
      // Common fields shown for both providers
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

  const handleToggle = async () => {
    const nextStatus = channel.status === 'connected' ? 'disconnected' : 'connected'
    setChannel(prev => ({ ...prev, status: nextStatus }))

    const res = await toggleIntegrationAction(channel.id)
    if (!res.ok) {
      setChannel(prev => ({ ...prev, status: channel.status }))
      toast.error(res.error || 'Failed to toggle integration')
    } else {
      toast.success(
        nextStatus === 'connected'
          ? `${channel.name} connected`
          : `${channel.name} disconnected`
      )
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const updatedConfig = {
      ...formData,
      environment: activeEnv,
    }

    const res = await saveIntegrationAction(channel.id, updatedConfig, channel.status)
    setIsSaving(false)

    if (!res.ok) {
      toast.error(res.error || 'Failed to save configuration')
      return
    }

    setChannel(prev => ({
      ...prev,
      config: updatedConfig,
      environment: activeEnv,
    }))
    toast.success(`${channel.name} configuration saved`)
  }

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
    setSelectedTemplate(templateName)
    toast.success(`Set "${templateName}" as default WhatsApp template`)
  }

  const handleRunHealthCheck = async () => {
    setIsHealthTesting(true)
    setHealthResult(null)
    const res = await testIntegrationAction(channel.id, undefined, activeEnv)
    setIsHealthTesting(false)

    if (res.ok) {
      setHealthResult({
        ok: true,
        message: res.data?.message || 'Handshake successful',
        latencyMs: res.data?.latencyMs,
      })
      toast.success(`${channel.name} (${activeEnv}) healthy`)
    } else {
      setHealthResult({
        ok: false,
        message: res.error || 'Connection check failed',
      })
      toast.error(res.error || 'Connection check failed')
    }
  }

  const handleSendLiveTest = async () => {
    if (!testRecipient.trim()) {
      toast.error('Recipient is required')
      return
    }

    setIsSendingTest(true)
    setTestSendResult(null)

    const res = await sendLiveTestChannelAction({
      channelId: channel.id,
      environment: activeEnv,
      recipient: testRecipient.trim(),
      message: testMessage.trim(),
      templateName: channel.id === 'whatsapp' ? selectedTemplate : undefined,
    })

    setIsSendingTest(false)

    if (res.ok) {
      setTestSendResult({
        ok: true,
        messageId: res.data?.messageId || 'OK',
        latencyMs: res.data?.latencyMs,
        timestamp: new Date().toLocaleTimeString(),
      })
      toast.success(`Test sent successfully to ${testRecipient}`)
    } else {
      setTestSendResult({
        ok: false,
        error: res.error || 'Send failed',
        timestamp: new Date().toLocaleTimeString(),
      })
      toast.error(res.error || 'Failed to send test message')
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header Bar */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <ChannelIcon id={channel.id} size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {channel.name} Integration
              </h1>
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {channel.provider}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">
              {isConnected ? channel.accountInfo : 'Not configured'}
            </p>
          </div>
        </div>

        {/* Right Header Status & Toggle */}
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Connected</span>
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
              Not connected
            </span>
          )}

          {/* Mode Pill */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              activeEnv === 'realtime'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {activeEnv === 'realtime' ? (
              <>
                <Radio size={12} className="text-blue-600" />
                <span>Realtime (Live)</span>
              </>
            ) : (
              <>
                <FlaskConical size={12} className="text-amber-600" />
                <span>Sandbox (Test)</span>
              </>
            )}
          </span>

          {/* Toggle Switch */}
          <label className="relative inline-flex items-center cursor-pointer ml-1">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isConnected}
              onChange={handleToggle}
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Environment Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium self-start">
          <button
            type="button"
            onClick={() => setActiveEnv('realtime')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
              activeEnv === 'realtime'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio size={13} className={activeEnv === 'realtime' ? 'text-emerald-600' : 'text-slate-400'} />
            <span>Realtime (Live)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEnv('sandbox')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
              activeEnv === 'sandbox'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FlaskConical size={13} className={activeEnv === 'sandbox' ? 'text-amber-600' : 'text-slate-400'} />
            <span>Sandbox (Test)</span>
          </button>
        </div>

        <span className="text-xs sm:text-sm text-slate-500">
          Editing {activeEnv === 'realtime' ? 'production live credentials' : 'test sandbox credentials'}
        </span>
      </div>

      {/* Two-Column Grid: Config on Left, Test Console on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Form */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSave}
            className="card p-5 shadow-xs border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {activeEnv === 'realtime' ? 'Realtime Credentials' : 'Sandbox Credentials'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Configure API keys and connection secrets for {channel.name}.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                AES-256-GCM
              </span>
            </div>

            {/* Webhook URL Box */}
            {channel.webhookUrl && (channel.id !== 'email' || activeEmailProvider === 'resend') && (
              <div className="space-y-1">
                <label className="label">
                  Webhook URL
                </label>
                <div className="flex items-center gap-2">
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
                    className="input !py-2 text-sm font-mono bg-slate-50 select-all"
                  />
                  <button
                    type="button"
                    onClick={copyWebhook}
                    className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 shrink-0 text-xs"
                    title="Copy URL"
                  >
                    {copied ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            )}

            {/* Credential Inputs */}
            {activeFields.map(f => {
              const isPassword = f.type === 'password'
              const configKey = activeEnv === 'sandbox' ? `sandbox_${f.key}` : f.key
              const isRevealed = revealed[configKey]
              const val = formData[configKey] ?? formData[f.key] ?? (f.key === 'provider' ? 'smtp' : '')

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

              const sectionSubtitle =
                f.key === 'smtp_host'
                  ? 'Authenticates with your mail server to deliver outbound outreach emails'
                  : f.key === 'imap_host'
                  ? 'Connects to your mailbox to track recipient replies and sync inbound threads'
                  : f.key === 'resend_api_key'
                  ? 'API credentials for transactional outbound delivery'
                  : f.key === 'from_name'
                  ? 'Defines the sender display name and monitored reply inbox'
                  : null

              if (f.type === 'select') {
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="label">
                      {f.label}
                    </label>
                    <select
                      className="input text-sm !py-2 bg-white"
                      value={val || 'smtp'}
                      onChange={e => handleChange(configKey, e.target.value)}
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
                    <div className="pt-3 pb-1 border-t border-slate-100 first:border-t-0 space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 tracking-wide">
                        {sectionTitle}
                      </span>
                      {sectionSubtitle && (
                        <p className="text-[11px] text-slate-500">
                          {sectionSubtitle}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="label">
                        {activeEnv === 'sandbox' ? `Sandbox ${f.label}` : f.label}
                      </label>
                      {activeEnv === 'sandbox' && !formData[configKey] && (
                        <span className="text-xs text-slate-400">
                          (Falls back to live if empty)
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={isPassword && !isRevealed ? 'password' : 'text'}
                        className="input !py-2 pr-9 text-sm font-mono"
                        placeholder={f.placeholder}
                        value={val}
                        onChange={e => handleChange(configKey, e.target.value)}
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(configKey)}
                          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600"
                          title={isRevealed ? 'Hide' : 'Show'}
                        >
                          {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              )
            })}

            {/* WhatsApp Approved Message Templates */}
            {channel.id === 'whatsapp' && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-900">
                    Approved Message Templates
                  </label>
                  <span className="text-xs text-slate-400">
                    {templatesList.length} configured
                  </span>
                </div>

                {/* Add template input row */}
                <div className="flex items-center gap-2">
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
                    className="input !py-1.5 text-sm font-mono flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddTemplate}
                    disabled={!newTemplateInput.trim()}
                    className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 shrink-0 text-xs"
                  >
                    <Plus size={13} />
                    <span>Add</span>
                  </button>
                </div>

                {/* List of templates */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {templatesList.map(tpl => {
                    const isDefault = (formData.default_template_name || 'selfera_sales_pipeline_general') === tpl
                    return (
                      <div
                        key={tpl}
                        className="flex items-center justify-between p-2 px-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono text-slate-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{tpl}</span>
                          {isDefault ? (
                            <span className="text-xs font-sans font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultTemplate(tpl)}
                              className="text-xs font-sans text-slate-400 hover:text-primary transition-colors underline"
                            >
                              Set as default
                            </button>
                          )}
                        </div>
                        {templatesList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTemplate(tpl)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 ml-2 shrink-0"
                            title="Remove template"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary btn-sm font-medium"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Health Check & Live Test Console */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: Connection Health Check */}
          <div className="card p-5 shadow-xs border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-slate-700" />
                <h3 className="text-base font-semibold text-slate-900">
                  Connection Health
                </h3>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  activeEnv === 'realtime'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {activeEnv.toUpperCase()}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500">
              {channel.id === 'email'
                ? activeEmailProvider === 'smtp'
                  ? 'Ping SMTP host and authenticate credentials without sending an email.'
                  : 'Ping Resend API to verify API key and response latency.'
                : 'Ping the provider API to verify credentials and response latency.'}
            </p>

            <button
              type="button"
              onClick={handleRunHealthCheck}
              disabled={isHealthTesting}
              className="btn btn-secondary btn-sm w-full inline-flex items-center justify-center gap-1.5"
            >
              {isHealthTesting ? (
                <RefreshCw size={13} className="animate-spin text-primary" />
              ) : (
                <Zap size={13} className="text-amber-500" />
              )}
              <span>{isHealthTesting ? 'Checking Connection...' : 'Run Connection Check'}</span>
            </button>

            {healthResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs sm:text-sm space-y-1 ${
                  healthResult.ok
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50/60 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>{healthResult.ok ? 'Connection Verified' : 'Check Failed'}</span>
                  {healthResult.latencyMs !== undefined && (
                    <span className="font-mono text-xs">
                      {healthResult.latencyMs}ms
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed break-words">
                  {healthResult.message}
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Interactive Live Test Console */}
          <div className="card p-5 shadow-xs border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={15} className="text-slate-700" />
                <h3 className="text-base font-semibold text-slate-900">
                  Interactive Test Console
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {activeEnv === 'realtime' ? 'Live Send' : 'Sandbox Test'}
              </span>
            </div>

            <div className="space-y-3">
              {/* Recipient */}
              <div className="space-y-1">
                <label className="label">
                  {channel.id === 'whatsapp' ? 'Recipient WhatsApp Number' : 'Recipient Email'}
                </label>
                <input
                  type="text"
                  value={testRecipient}
                  onChange={e => setTestRecipient(e.target.value)}
                  placeholder={channel.id === 'whatsapp' ? 'e.g. +44 7123 456789 or +91 98765 43210' : 'test@example.com'}
                  className="input text-sm !py-2 font-mono"
                />
              </div>

              {/* Template selector for WhatsApp */}
              {channel.id === 'whatsapp' && (
                <div className="space-y-1">
                  <label className="label">
                    Template to Send
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={e => setSelectedTemplate(e.target.value)}
                    className="input text-sm !py-2 font-mono"
                  >
                    {templatesList.map(tpl => (
                      <option key={tpl} value={tpl}>
                        {tpl} {tpl === formData.default_template_name ? '(Default)' : tpl === 'hello_world' ? '(Meta Sandbox Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Message Body */}
              <div className="space-y-1">
                <label className="label">
                  Test Message Body
                </label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="input text-sm !py-2 leading-relaxed"
                />
              </div>

              {/* Send Test Button */}
              <button
                type="button"
                onClick={handleSendLiveTest}
                disabled={isSendingTest || !testRecipient.trim()}
                className="btn btn-primary btn-sm w-full inline-flex items-center justify-center gap-1.5"
              >
                {isSendingTest ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>
                  {isSendingTest ? 'Sending Test...' : `Send Test (${activeEnv.toUpperCase()})`}
                </span>
              </button>

              {/* Test Output Box */}
              {testSendResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs sm:text-sm space-y-1 mt-2 ${
                    testSendResult.ok
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50/60 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{testSendResult.ok ? 'Message Delivered' : 'Delivery Error'}</span>
                    <span className="font-mono text-xs">
                      {testSendResult.timestamp} {testSendResult.latencyMs ? `· ${testSendResult.latencyMs}ms` : ''}
                    </span>
                  </div>
                  {testSendResult.ok ? (
                    <p className="text-xs font-mono break-all">
                      ID: {testSendResult.messageId}
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed break-words">
                      {testSendResult.error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

