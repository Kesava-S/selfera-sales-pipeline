'use client'

import { useState, useMemo } from 'react'
import {
  Mail,
  Plus,
  Send,
  Trash2,
  Edit3,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  Eye,
  Check,
  Search,
  Filter,
} from 'lucide-react'
import { CONFIG } from '@/lib/config'
import {
  saveEmailCampaign,
  deleteEmailCampaign,
  sendTestEmailCampaign,
  launchEmailCampaign,
  type EmailCampaignInput,
} from '@/app/dashboard/actions'
import { Modal, useAction, ErrorNote, Spinner } from '@/components/ui'

export type LeadRecipient = {
  id: string
  business_name: string
  contact_name: string | null
  email: string
  category: string | null
  business_type: string | null
  stage?: string | null
  services?: string[] | null
}

export type CampaignRow = {
  id: string
  name: string
  subject: string
  preheader: string | null
  body: string
  service: string
  target_category: string
  target_stage: string
  status: 'draft' | 'scheduled' | 'sent' | 'archived'
  recipient_count: number
  recipients: LeadRecipient[]
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

export type EmailTemplate = {
  id: string
  name: string
  subject: string | null
  body: string
  step?: string | null
}

const SERVICES = ['General', ...CONFIG.SERVICES]
const CATEGORIES = ['All', ...Object.keys(CONFIG.BUSINESS_CATEGORIES)]

export function EmailCampaignsView({
  campaigns: initialCampaigns,
  leads,
  templates,
  userEmail,
}: {
  campaigns: CampaignRow[]
  leads: LeadRecipient[]
  templates: EmailTemplate[]
  userEmail: string
}) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns)
  const [isCreating, setIsCreating] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [service, setService] = useState('General')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [body, setBody] = useState('')
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [showRecipientList, setShowRecipientList] = useState(false)
  const [recipientSearch, setRecipientSearch] = useState('')

  // Test send modal
  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testRecipient, setTestRecipient] = useState(userEmail)
  const [testSentSuccess, setTestSentSuccess] = useState(false)

  // Launch modal
  const [launchModalOpen, setLaunchModalOpen] = useState(false)
  const [launchSuccessInfo, setLaunchSuccessInfo] = useState<{ count: number; simulated?: boolean } | null>(null)

  const { run, pending, error } = useAction()
  const { run: runTest, pending: testPending, error: testError } = useAction()
  const { run: runLaunch, pending: launchPending, error: launchError } = useAction()

  // Filtered leads based on category
  const categoryMatchedLeads = useMemo(() => {
    return leads.filter(l => {
      if (categoryFilter !== 'All' && l.category !== categoryFilter) return false
      return true
    })
  }, [leads, categoryFilter])

  // Search filtered leads
  const displayedLeads = useMemo(() => {
    if (!recipientSearch.trim()) return categoryMatchedLeads
    const q = recipientSearch.toLowerCase()
    return categoryMatchedLeads.filter(
      l =>
        l.business_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.contact_name && l.contact_name.toLowerCase().includes(q))
    )
  }, [categoryMatchedLeads, recipientSearch])

  // Open Create Mode
  const startNewCampaign = () => {
    setEditingCampaign(null)
    setName('')
    setService('General')
    setCategoryFilter('All')
    setSubject('')
    setPreheader('')
    setBody(
      'Hi {contact_name},\n\nI came across {business_name} and was really impressed by what you are building.\n\nWe help UK businesses automate customer bookings, outreach, and inquiries so you never miss a prospective client.\n\nWould you be open to a quick 5-minute chat this week?\n\nBest regards,\nSales Team'
    )
    // Select all leads by default
    setSelectedLeadIds(new Set(leads.map(l => l.id)))
    setIsCreating(true)
  }

  // Edit existing campaign
  const startEditCampaign = (c: CampaignRow) => {
    setEditingCampaign(c)
    setName(c.name)
    setService(c.service || 'General')
    setCategoryFilter(c.target_category || 'All')
    setSubject(c.subject)
    setPreheader(c.preheader || '')
    setBody(c.body)

    const existingIds = new Set(
      (Array.isArray(c.recipients) ? c.recipients : []).map(r => r.id)
    )
    if (existingIds.size > 0) {
      setSelectedLeadIds(existingIds)
    } else {
      setSelectedLeadIds(new Set(leads.map(l => l.id)))
    }
    setIsCreating(true)
  }

  const cancelEdit = () => {
    setIsCreating(false)
    setEditingCampaign(null)
  }

  // Toggle lead selection
  const toggleLead = (id: string) => {
    const next = new Set(selectedLeadIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedLeadIds(next)
  }

  const selectAllCategoryLeads = () => {
    const next = new Set(selectedLeadIds)
    categoryMatchedLeads.forEach(l => next.add(l.id))
    setSelectedLeadIds(next)
  }

  const deselectAllCategoryLeads = () => {
    const next = new Set(selectedLeadIds)
    categoryMatchedLeads.forEach(l => next.delete(l.id))
    setSelectedLeadIds(next)
  }

  // Insert variable tag into body
  const insertVariable = (tag: string) => {
    setBody(prev => prev + ` {${tag}}`)
  }

  // Apply template
  const applyTemplate = (tId: string) => {
    const t = templates.find(item => item.id === tId)
    if (!t) return
    if (t.subject) setSubject(t.subject)
    setBody(t.body)
  }

  // Sample lead for live preview
  const sampleLead = useMemo(() => {
    const firstSelected = leads.find(l => selectedLeadIds.has(l.id))
    return (
      firstSelected ||
      leads[0] || {
        id: 'sample',
        business_name: 'The Crown Tavern',
        contact_name: 'Alex Morgan',
        email: 'alex@crowntavern.co.uk',
        category: 'Food & Drink',
        business_type: 'Pub / Bar',
      }
    )
  }, [leads, selectedLeadIds])

  // Formatted preview content
  const previewSubject = useMemo(() => {
    return (subject || 'Subject line preview')
      .replace(/\{business_name\}/g, sampleLead.business_name || 'your business')
      .replace(/\{contact_name\}/g, sampleLead.contact_name || 'there')
      .replace(/\{service\}/g, service || 'our services')
  }, [subject, sampleLead, service])

  const previewBody = useMemo(() => {
    return (body || 'Type your message body on the left to see live preview...')
      .replace(/\{business_name\}/g, sampleLead.business_name || 'your business')
      .replace(/\{contact_name\}/g, sampleLead.contact_name || 'there')
      .replace(/\{service\}/g, service || 'our services')
  }, [body, sampleLead, service])

  // Save campaign handler
  const handleSaveDraft = (status: 'draft' | 'scheduled' = 'draft') => {
    const chosenRecipients = leads
      .filter(l => selectedLeadIds.has(l.id))
      .map(l => ({
        id: l.id,
        business_name: l.business_name,
        contact_name: l.contact_name,
        email: l.email,
      }))

    const payload: EmailCampaignInput = {
      id: editingCampaign?.id || null,
      name,
      subject,
      preheader: preheader.trim() || null,
      body,
      service,
      targetCategory: categoryFilter,
      targetStage: 'All',
      status,
      recipientCount: chosenRecipients.length,
      recipients: chosenRecipients,
    }

    run(
      () => saveEmailCampaign(payload),
      res => {
        if (res?.ok && res.data) {
          const updatedCampaign: CampaignRow = {
            id: res.data.id,
            name: payload.name,
            subject: payload.subject,
            preheader: payload.preheader || null,
            body: payload.body,
            service: payload.service || 'General',
            target_category: payload.targetCategory || 'All',
            target_stage: payload.targetStage || 'All',
            status: payload.status || 'draft',
            recipient_count: payload.recipientCount || 0,
            recipients: chosenRecipients,
            scheduled_at: null,
            sent_at: null,
            created_at: new Date().toISOString(),
          }

          setCampaigns(prev => {
            const exists = prev.some(c => c.id === updatedCampaign.id)
            if (exists) return prev.map(c => (c.id === updatedCampaign.id ? updatedCampaign : c))
            return [updatedCampaign, ...prev]
          })
          setIsCreating(false)
        }
      }
    )
  }

  // Handle launch
  const executeLaunch = (cId: string) => {
    runLaunch(
      () => launchEmailCampaign(cId),
      res => {
        if (res?.ok && res.data) {
          setLaunchSuccessInfo({
            count: res.data.sentCount,
            simulated: res.data.simulated,
          })
          setCampaigns(prev =>
            prev.map(c =>
              c.id === cId
                ? { ...c, status: 'sent', sent_at: new Date().toISOString(), recipient_count: res.data!.sentCount }
                : c
            )
          )
        }
      }
    )
  }

  // Delete campaign
  const handleDelete = (id: string) => {
    run(
      () => deleteEmailCampaign(id),
      () => {
        setCampaigns(prev => prev.filter(c => c.id !== id))
        setDeleteConfirmId(null)
      }
    )
  }

  // Overview stats
  const totalCampaigns = campaigns.length
  const totalSent = campaigns.filter(c => c.status === 'sent').reduce((acc, c) => acc + (c.recipient_count || 0), 0)
  const activeDrafts = campaigns.filter(c => c.status === 'draft').length

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email Campaigns</h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">
              Email Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Create, target, and launch simple personalized outbound email campaigns.
          </p>
        </div>

        <div>
          {isCreating ? (
            <button
              onClick={cancelEdit}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
            >
              <ArrowLeft size={15} /> Back to campaigns
            </button>
          ) : (
            <button
              onClick={startNewCampaign}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={16} /> New Campaign
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW A: CAMPAIGN CREATION AREA                                */}
      {/* ------------------------------------------------------------- */}
      {isCreating ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Campaign Builder Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Campaign Info */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    1
                  </span>
                  <h2 className="font-semibold text-base text-slate-900">Campaign Details</h2>
                </div>
                <span className="text-xs text-slate-400 font-medium">Step 1 of 3</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label">Campaign Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. London Coffee Shops - Automation Pitch"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">Target Service Focus</label>
                  <select
                    className="input"
                    value={service}
                    onChange={e => setService(e.target.value)}
                  >
                    {SERVICES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Audience Filter */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    2
                  </span>
                  <h2 className="font-semibold text-base text-slate-900">Target Audience</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selectedLeadIds.size} recipient{selectedLeadIds.size === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label">Filter by Business Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map(cat => {
                      const active = categoryFilter === cat
                      const count = leads.filter(l => cat === 'All' || l.category === cat).length
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {cat} <span className="opacity-70 ml-0.5">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {categoryMatchedLeads.length} leads in category with email
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllCategoryLeads}
                        className="text-primary hover:underline font-semibold"
                      >
                        Select all
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={deselectAllCategoryLeads}
                        className="text-slate-500 hover:underline"
                      >
                        Deselect all
                      </button>
                    </div>
                  </div>

                  {/* Toggle view recipient list */}
                  <button
                    type="button"
                    onClick={() => setShowRecipientList(!showRecipientList)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-white rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-1.5">
                      <Users size={14} className="text-slate-500" />
                      {showRecipientList ? 'Hide recipient list' : 'View & customize recipient list'}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {selectedLeadIds.size} selected
                    </span>
                  </button>

                  {showRecipientList && (
                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search recipients by business or email..."
                          className="input !text-xs !py-1.5 !pl-8"
                          value={recipientSearch}
                          onChange={e => setRecipientSearch(e.target.value)}
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 text-xs">
                        {displayedLeads.length === 0 ? (
                          <div className="p-3 text-center text-slate-400">No matching leads with email.</div>
                        ) : (
                          displayedLeads.map(lead => {
                            const isChecked = selectedLeadIds.has(lead.id)
                            return (
                              <label
                                key={lead.id}
                                className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleLead(lead.id)}
                                    className="rounded border-slate-300 text-primary focus:ring-primary"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-800 truncate">
                                      {lead.business_name}
                                    </div>
                                    <div className="text-slate-400 text-[11px] truncate">
                                      {lead.email} {lead.contact_name ? `(${lead.contact_name})` : ''}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                  {lead.business_type || lead.category || ''}
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Email Content */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    3
                  </span>
                  <h2 className="font-semibold text-base text-slate-900">Email Message</h2>
                </div>

                {templates.length > 0 && (
                  <select
                    className="input !w-auto !py-1 !text-xs text-slate-600"
                    onChange={e => {
                      if (e.target.value) applyTemplate(e.target.value)
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Load from template...
                    </option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="label">Subject Line</label>
                  <input
                    type="text"
                    className="input font-medium"
                    placeholder="e.g. Quick question regarding operations at {business_name}"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label !mb-0">Preheader / Snippet (Optional)</label>
                    <span className="text-[11px] text-slate-400">Preview text in recipient inbox</span>
                  </div>
                  <input
                    type="text"
                    className="input !text-xs text-slate-600"
                    placeholder="e.g. A quick note on streamlining customer inquiries this week"
                    value={preheader}
                    onChange={e => setPreheader(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label !mb-0">Message Body</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400 mr-1">Insert:</span>
                      <button
                        type="button"
                        onClick={() => insertVariable('business_name')}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                        title="Insert Business Name"
                      >
                        {'{business_name}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('contact_name')}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                        title="Insert Contact Name"
                      >
                        {'{contact_name}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('service')}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                        title="Insert Service"
                      >
                        {'{service}'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={9}
                    className="input font-sans text-sm leading-relaxed"
                    placeholder="Hi {contact_name},\n\nWrite your outreach message here..."
                    value={body}
                    onChange={e => setBody(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Error Display */}
            <ErrorNote error={error} />

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTestEmailOpen(true)}
                disabled={!subject.trim() || !body.trim()}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-slate-700"
              >
                <Send size={14} /> Send test email
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDraft('draft')}
                  disabled={pending || !name.trim() || !subject.trim() || !body.trim()}
                  className="btn btn-secondary btn-sm"
                >
                  {pending && <Spinner size={14} />} Save draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveDraft('draft')
                    setLaunchModalOpen(true)
                  }}
                  disabled={
                    pending ||
                    !name.trim() ||
                    !subject.trim() ||
                    !body.trim() ||
                    selectedLeadIds.size === 0
                  }
                  className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={14} /> Review & Launch
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Interactive Email Preview */}
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            <div className="card p-0 overflow-hidden shadow-sm border border-slate-200">
              {/* Fake Email Client Header */}
              <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 ml-2">Inbox Preview</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
                  <Eye size={12} /> Live preview
                </div>
              </div>

              {/* Email Envelope Metadata */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-2 text-xs">
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 w-14 shrink-0 font-medium">From:</span>
                  <span className="font-semibold text-slate-800">
                    Selfera &lt;support@selfera.co.uk&gt;
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 w-14 shrink-0 font-medium">To:</span>
                  <span className="text-slate-700 truncate">
                    {sampleLead.contact_name ? `${sampleLead.contact_name} ` : ''}
                    &lt;{sampleLead.email}&gt;
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 w-14 shrink-0 font-medium">Subject:</span>
                  <span className="font-bold text-slate-900 break-words">{previewSubject}</span>
                </div>
                {preheader && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-400 w-14 shrink-0 font-medium">Snippet:</span>
                    <span className="text-slate-500 italic truncate">{preheader}</span>
                  </div>
                )}
              </div>

              {/* Email Body Rendering */}
              <div className="p-6 bg-white min-h-[300px] flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Selfera Minimal Branded Top Bar */}
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-extrabold tracking-tight text-slate-900">
                      Selfera<span className="text-primary">.</span>
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                      Outreach
                    </span>
                  </div>

                  {/* Rendered Text with paragraph breaks */}
                  <div className="text-sm text-slate-800 leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
                    {previewBody}
                  </div>
                </div>

                {/* Email Footer Branding */}
                <div className="pt-8 mt-6 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
                  <div>Selfera &middot; London, United Kingdom</div>
                  <div>Direct customer engagement & pipeline automation.</div>
                </div>
              </div>
            </div>

            {/* Info note */}
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-sky-600" /> Human-in-the-Loop Safe
              </div>
              <p className="text-sky-700 leading-normal">
                Variables like <code className="bg-sky-100 px-1 py-0.5 rounded text-[11px]">{"{business_name}"}</code> are dynamically personalized per recipient upon sending.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* VIEW B: CAMPAIGN OVERVIEW & LIST                              */
        /* ------------------------------------------------------------- */
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-3 border border-slate-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-primary">
                <Mail size={20} />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Total Campaigns</div>
                <div className="text-xl font-bold text-slate-900">{totalCampaigns}</div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3 border border-slate-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Clock size={20} />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Drafts Ready</div>
                <div className="text-xl font-bold text-slate-900">{activeDrafts}</div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3 border border-slate-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Emails Dispatched</div>
                <div className="text-xl font-bold text-slate-900">{totalSent}</div>
              </div>
            </div>
          </div>

          {/* Campaign List */}
          <div className="card p-0 overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Your Campaigns</h2>
                <p className="text-xs text-slate-500">Manage all draft and sent email outreach sequences.</p>
              </div>
              <button
                onClick={startNewCampaign}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                <Plus size={15} /> Create Campaign
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Mail size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800">No email campaigns created yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Design a minimalist outreach email and send it to your targeted prospective businesses in a few clicks.
                  </p>
                </div>
                <button
                  onClick={startNewCampaign}
                  className="btn btn-primary btn-sm mx-auto flex items-center gap-1.5"
                >
                  <Plus size={15} /> Create your first campaign
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {campaigns.map(c => {
                  const isSent = c.status === 'sent'
                  return (
                    <div
                      key={c.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-bold text-slate-900 truncate">{c.name}</h3>
                          <span
                            className={`badge border ${
                              isSent
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {isSent ? 'Sent' : 'Draft'}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            &middot; {c.service}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 line-clamp-1">
                          <span className="font-medium text-slate-700">Subject:</span> {c.subject}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium pt-0.5">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Users size={13} /> {c.recipient_count || 0} recipient{c.recipient_count === 1 ? '' : 's'}
                          </span>
                          <span>&middot;</span>
                          <span>Category: {c.target_category || 'All'}</span>
                          {c.sent_at && (
                            <>
                              <span>&middot;</span>
                              <span>Sent {new Date(c.sent_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!isSent && (
                          <button
                            onClick={() => {
                              setEditingCampaign(c)
                              setLaunchModalOpen(true)
                            }}
                            className="btn btn-primary btn-sm flex items-center gap-1.5"
                          >
                            <Send size={13} /> Launch
                          </button>
                        )}
                        <button
                          onClick={() => startEditCampaign(c)}
                          className="btn btn-secondary btn-sm flex items-center gap-1.5"
                        >
                          <Edit3 size={13} /> {isSent ? 'View' : 'Edit'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(c.id)}
                          className="btn btn-ghost btn-sm text-slate-400 hover:text-rose-600"
                          title="Delete campaign"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: SEND TEST EMAIL                                        */}
      {/* ------------------------------------------------------------- */}
      {testEmailOpen && (
        <Modal
          title="Send Test Email"
          open
          onClose={() => {
            setTestEmailOpen(false)
            setTestSentSuccess(false)
          }}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Send a test copy to verify how the subject line and executive email layout will look in your inbox.
            </p>

            <div>
              <label className="label">Send Test To</label>
              <input
                type="email"
                className="input"
                placeholder="your.email@selfera.co.uk"
                value={testRecipient}
                onChange={e => {
                  setTestRecipient(e.target.value)
                  setTestSentSuccess(false)
                }}
              />
            </div>

            {testSentSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                Test email sent successfully! Check your inbox.
              </div>
            )}

            <ErrorNote error={testError} />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setTestEmailOpen(false)
                  setTestSentSuccess(false)
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm flex items-center gap-1.5"
                disabled={testPending || !testRecipient.includes('@')}
                onClick={() => {
                  setTestSentSuccess(false)
                  runTest(
                    () =>
                      sendTestEmailCampaign({
                        to: testRecipient,
                        subject: previewSubject,
                        body: previewBody,
                      }),
                    () => setTestSentSuccess(true)
                  )
                }}
              >
                {testPending && <Spinner size={14} />} Send Test Now
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CONFIRM & LAUNCH CAMPAIGN                              */}
      {/* ------------------------------------------------------------- */}
      {launchModalOpen && (
        <Modal
          title="Launch Email Campaign"
          open
          onClose={() => {
            setLaunchModalOpen(false)
            setLaunchSuccessInfo(null)
          }}
        >
          <div className="space-y-4">
            {launchSuccessInfo ? (
              <div className="space-y-3 py-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Campaign Successfully Launched!</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Dispatched outreach to <strong>{launchSuccessInfo.count}</strong> lead
                  {launchSuccessInfo.count === 1 ? '' : 's'}.
                  {launchSuccessInfo.simulated && (
                    <span className="block text-slate-400 mt-1 italic">
                      (SMTP not active in local env; recorded as simulated dispatch)
                    </span>
                  )}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mx-auto"
                    onClick={() => {
                      setLaunchModalOpen(false)
                      setLaunchSuccessInfo(null)
                      setIsCreating(false)
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  Please review campaign summary before launching:
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Campaign Name:</span>
                    <span className="font-semibold text-slate-800">{name || editingCampaign?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Service:</span>
                    <span className="font-medium text-slate-800">{service || editingCampaign?.service}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Recipients:</span>
                    <span className="font-bold text-slate-900">
                      {selectedLeadIds.size || editingCampaign?.recipient_count || 0} leads
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subject:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[200px]">
                      {subject || editingCampaign?.subject}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                  This action will queue emails for all matching leads. Outbound communications comply with human review policies.
                </div>

                <ErrorNote error={launchError} />

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setLaunchModalOpen(false)}
                    disabled={launchPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                    disabled={launchPending}
                    onClick={() => {
                      const idToLaunch = editingCampaign?.id || campaigns[0]?.id
                      if (idToLaunch) {
                        executeLaunch(idToLaunch)
                      }
                    }}
                  >
                    {launchPending && <Spinner size={14} />} Confirm & Launch
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DELETE CONFIRMATION                                    */}
      {/* ------------------------------------------------------------- */}
      {deleteConfirmId && (
        <Modal
          title="Delete Campaign"
          open
          onClose={() => setDeleteConfirmId(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this campaign? This action cannot be undone.
            </p>
            <ErrorNote error={error} />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                {pending && <Spinner size={14} />} Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
