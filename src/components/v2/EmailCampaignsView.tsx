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
  Database,
  Layers,
  FileSpreadsheet,
  X,
} from 'lucide-react'
import { CONFIG } from '@/lib/config'
import {
  saveEmailCampaign,
  deleteEmailCampaign,
  saveEmailDatabase,
  deleteEmailDatabase,
  sendTestEmailCampaign,
  launchEmailCampaign,
  type EmailCampaignInput,
  type EmailDatabaseInput,
} from '@/app/dashboard/actions'
import { Modal, useAction, ErrorNote, Spinner } from '@/components/ui'

export type DatabaseContact = {
  id?: string
  business_name: string
  email: string
  contact_name?: string | null
  category?: string | null
  business_type?: string | null
}

export type EmailDatabaseRow = {
  id: string
  name: string
  description: string | null
  contacts: DatabaseContact[]
  contact_count: number
  created_at: string
}

export type CampaignRow = {
  id: string
  name: string
  subject: string
  preheader: string | null
  body: string
  service: string
  database_id: string | null
  database_name: string | null
  status: 'draft' | 'scheduled' | 'sent' | 'archived'
  recipient_count: number
  recipients: DatabaseContact[]
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

export type PipelineLead = {
  id: string
  business_name: string
  contact_name: string | null
  email: string
  category: string | null
  business_type: string | null
}

const SERVICES = ['General', ...CONFIG.SERVICES]

export function EmailCampaignsView({
  campaigns: initialCampaigns,
  databases: initialDatabases,
  pipelineLeads,
  templates,
  userEmail,
}: {
  campaigns: CampaignRow[]
  databases: EmailDatabaseRow[]
  pipelineLeads: PipelineLead[]
  templates: EmailTemplate[]
  userEmail: string
}) {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'databases'>('campaigns')
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns)
  const [databases, setDatabases] = useState<EmailDatabaseRow[]>(initialDatabases)

  // Campaign Form State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [service, setService] = useState('General')
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>(
    initialDatabases[0]?.id || ''
  )
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [body, setBody] = useState('')

  // Database Creation / Edit Modal
  const [dbModalOpen, setDbModalOpen] = useState(false)
  const [editingDb, setEditingDb] = useState<EmailDatabaseRow | null>(null)
  const [dbName, setDbName] = useState('')
  const [dbDescription, setDbDescription] = useState('')
  const [dbContacts, setDbContacts] = useState<DatabaseContact[]>([])
  const [pasteInput, setPasteInput] = useState('')
  const [leadPickerSearch, setLeadPickerSearch] = useState('')
  const [addMode, setAddMode] = useState<'pick' | 'paste'>('pick')

  // Deletion modals
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null)
  const [deleteDbId, setDeleteDbId] = useState<string | null>(null)

  // Test send modal
  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testRecipient, setTestRecipient] = useState(userEmail)
  const [testSentSuccess, setTestSentSuccess] = useState(false)

  // Launch modal
  const [launchModalOpen, setLaunchModalOpen] = useState(false)
  const [launchSuccessInfo, setLaunchSuccessInfo] = useState<{ count: number; simulated?: boolean } | null>(null)

  const { run, pending, error } = useAction()
  const { run: runDb, pending: dbPending, error: dbError } = useAction()
  const { run: runTest, pending: testPending, error: testError } = useAction()
  const { run: runLaunch, pending: launchPending, error: launchError } = useAction()

  // Selected database object for the campaign
  const activeSelectedDb = useMemo(() => {
    return databases.find(d => d.id === selectedDatabaseId) || databases[0] || null
  }, [databases, selectedDatabaseId])

  // Start new campaign
  const startNewCampaign = () => {
    setEditingCampaign(null)
    setCampaignName('')
    setService('General')
    setSelectedDatabaseId(databases[0]?.id || '')
    setSubject('')
    setPreheader('')
    setBody(
      'Hi {contact_name},\n\nI noticed the great work {business_name} is doing.\n\nWe help businesses streamline customer bookings, follow ups, and inquiries into a unified queue so you never miss a client.\n\nWould you be open to a quick 5-minute chat this week?\n\nBest regards,\nSales Team'
    )
    setIsCreatingCampaign(true)
  }

  // Edit existing campaign
  const startEditCampaign = (c: CampaignRow) => {
    setEditingCampaign(c)
    setCampaignName(c.name)
    setService(c.service || 'General')
    setSelectedDatabaseId(c.database_id || databases[0]?.id || '')
    setSubject(c.subject)
    setPreheader(c.preheader || '')
    setBody(c.body)
    setIsCreatingCampaign(true)
  }

  const cancelCampaignEdit = () => {
    setIsCreatingCampaign(false)
    setEditingCampaign(null)
  }

  // Open modal to create database
  const openCreateDatabase = () => {
    setEditingDb(null)
    setDbName('')
    setDbDescription('')
    setDbContacts([])
    setPasteInput('')
    setAddMode('pick')
    setDbModalOpen(true)
  }

  // Open modal to edit database
  const openEditDatabase = (db: EmailDatabaseRow) => {
    setEditingDb(db)
    setDbName(db.name)
    setDbDescription(db.description || '')
    setDbContacts(Array.isArray(db.contacts) ? [...db.contacts] : [])
    setPasteInput('')
    setAddMode('pick')
    setDbModalOpen(true)
  }

  // Add parsed contacts from paste input
  const handleAddPastedContacts = () => {
    if (!pasteInput.trim()) return
    const lines = pasteInput.split('\n')
    const added: DatabaseContact[] = []

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      // Support: "business_name, email, contact_name" or "email" or "business, email"
      const parts = line.split(',').map(p => p.trim())
      let email = ''
      let business_name = ''
      let contact_name = ''

      if (parts.length === 1) {
        email = parts[0]
        business_name = email.split('@')[0]
      } else if (parts.length === 2) {
        business_name = parts[0]
        email = parts[1]
      } else {
        business_name = parts[0]
        email = parts[1]
        contact_name = parts[2]
      }

      if (email && email.includes('@')) {
        added.push({
          business_name: business_name || 'Business',
          email: email.toLowerCase(),
          contact_name: contact_name || null,
        })
      }
    }

    if (added.length > 0) {
      setDbContacts(prev => [...prev, ...added])
      setPasteInput('')
    }
  }

  // Toggle contact from pipeline
  const togglePipelineContact = (lead: PipelineLead) => {
    setDbContacts(prev => {
      const exists = prev.some(c => c.email.toLowerCase() === lead.email.toLowerCase())
      if (exists) {
        return prev.filter(c => c.email.toLowerCase() !== lead.email.toLowerCase())
      } else {
        return [
          ...prev,
          {
            id: lead.id,
            business_name: lead.business_name,
            email: lead.email,
            contact_name: lead.contact_name,
            category: lead.category,
            business_type: lead.business_type,
          },
        ]
      }
    })
  }

  const removeContactFromDb = (email: string) => {
    setDbContacts(prev => prev.filter(c => c.email !== email))
  }

  // Save database handler
  const handleSaveDatabase = () => {
    const payload: EmailDatabaseInput = {
      id: editingDb?.id || null,
      name: dbName,
      description: dbDescription.trim() || null,
      contacts: dbContacts,
    }

    runDb(
      () => saveEmailDatabase(payload),
      data => {
        if (data?.id) {
          const newDbRow: EmailDatabaseRow = {
            id: data.id,
            name: payload.name,
            description: payload.description || null,
            contacts: dbContacts,
            contact_count: dbContacts.length,
            created_at: new Date().toISOString(),
          }

          setDatabases(prev => {
            const exists = prev.some(d => d.id === newDbRow.id)
            if (exists) return prev.map(d => (d.id === newDbRow.id ? newDbRow : d))
            return [newDbRow, ...prev]
          })

          setSelectedDatabaseId(newDbRow.id)
          setDbModalOpen(false)
        }
      }
    )
  }

  // Delete database handler
  const handleDeleteDatabase = (id: string) => {
    run(
      () => deleteEmailDatabase(id),
      () => {
        setDatabases(prev => prev.filter(d => d.id !== id))
        if (selectedDatabaseId === id) {
          setSelectedDatabaseId(databases.find(d => d.id !== id)?.id || '')
        }
        setDeleteDbId(null)
      }
    )
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
    if (activeSelectedDb && activeSelectedDb.contacts.length > 0) {
      return activeSelectedDb.contacts[0]
    }
    return {
      business_name: 'The Crown Hotel',
      contact_name: 'Alex Morgan',
      email: 'alex@crownhotel.co.uk',
    }
  }, [activeSelectedDb])

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
  const handleSaveCampaign = (status: 'draft' | 'scheduled' = 'draft') => {
    const db = activeSelectedDb
    const recipients = db?.contacts || []

    const payload: EmailCampaignInput = {
      id: editingCampaign?.id || null,
      name: campaignName,
      subject,
      preheader: preheader.trim() || null,
      body,
      service,
      databaseId: db?.id || null,
      databaseName: db?.name || 'Custom Database',
      status,
      recipientCount: recipients.length,
      recipients: recipients.map(r => ({
        id: r.id || r.email,
        business_name: r.business_name,
        contact_name: r.contact_name || null,
        email: r.email,
      })),
    }

    run(
      () => saveEmailCampaign(payload),
      data => {
        if (data?.id) {
          const updatedCampaign: CampaignRow = {
            id: data.id,
            name: payload.name,
            subject: payload.subject,
            preheader: payload.preheader || null,
            body: payload.body,
            service: payload.service || 'General',
            database_id: payload.databaseId || null,
            database_name: payload.databaseName || null,
            status: payload.status || 'draft',
            recipient_count: payload.recipientCount || 0,
            recipients: payload.recipients || [],
            scheduled_at: null,
            sent_at: null,
            created_at: new Date().toISOString(),
          }

          setCampaigns(prev => {
            const exists = prev.some(c => c.id === updatedCampaign.id)
            if (exists) return prev.map(c => (c.id === updatedCampaign.id ? updatedCampaign : c))
            return [updatedCampaign, ...prev]
          })
          setIsCreatingCampaign(false)
        }
      }
    )
  }

  // Execute launch
  const executeLaunch = (cId: string) => {
    runLaunch(
      () => launchEmailCampaign(cId),
      data => {
        if (data) {
          setLaunchSuccessInfo({
            count: data.sentCount,
            simulated: data.simulated,
          })
          setCampaigns(prev =>
            prev.map(c =>
              c.id === cId
                ? { ...c, status: 'sent', sent_at: new Date().toISOString(), recipient_count: data.sentCount }
                : c
            )
          )
        }
      }
    )
  }

  // Delete campaign
  const handleDeleteCampaign = (id: string) => {
    run(
      () => deleteEmailCampaign(id),
      () => {
        setCampaigns(prev => prev.filter(c => c.id !== id))
        setDeleteCampaignId(null)
      }
    )
  }

  // Filtered pipeline leads for modal picker
  const filteredPipelineLeads = useMemo(() => {
    if (!leadPickerSearch.trim()) return pipelineLeads
    const q = leadPickerSearch.toLowerCase()
    return pipelineLeads.filter(
      l =>
        l.business_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.contact_name && l.contact_name.toLowerCase().includes(q))
    )
  }, [pipelineLeads, leadPickerSearch])

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
            Organize custom target databases and run simple, personalized email campaigns.
          </p>
        </div>

        {/* View Switcher / New Action */}
        <div className="flex items-center gap-2">
          {!isCreatingCampaign && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('campaigns')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'campaigns'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Campaigns ({campaigns.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('databases')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'databases'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Database size={13} /> Target Databases ({databases.length})
              </button>
            </div>
          )}

          {isCreatingCampaign ? (
            <button
              onClick={cancelCampaignEdit}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
            >
              <ArrowLeft size={15} /> Back to campaigns
            </button>
          ) : activeTab === 'campaigns' ? (
            <button
              onClick={startNewCampaign}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={16} /> New Campaign
            </button>
          ) : (
            <button
              onClick={openCreateDatabase}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={16} /> Create Database
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW: CREATE / EDIT CAMPAIGN (TARGET DATABASE-DRIVEN)         */}
      {/* ------------------------------------------------------------- */}
      {isCreatingCampaign ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Builder */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Campaign Details */}
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
                    placeholder="e.g. October London Boutiques Outreach"
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">Service Focus</label>
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

            {/* Step 2: Target Database Selector */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    2
                  </span>
                  <h2 className="font-semibold text-base text-slate-900">Select Target Database</h2>
                </div>
                <button
                  type="button"
                  onClick={openCreateDatabase}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Create New Database
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Pick the database you want to run this campaign against. Each database contains your curated list of business contacts.
                </p>

                {databases.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center space-y-2">
                    <Database size={24} className="mx-auto text-slate-400" />
                    <p className="text-xs text-slate-600 font-medium">No target databases created yet.</p>
                    <button
                      type="button"
                      onClick={openCreateDatabase}
                      className="btn btn-primary btn-sm mx-auto"
                    >
                      Create your first database
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {databases.map(db => {
                      const selected = db.id === selectedDatabaseId
                      return (
                        <div
                          key={db.id}
                          onClick={() => setSelectedDatabaseId(db.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                            selected
                              ? 'border-primary bg-primary-bg/30 ring-1 ring-primary'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-900 truncate">
                                {db.name}
                              </span>
                              {selected && (
                                <span className="h-4 w-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                                  <Check size={10} />
                                </span>
                              )}
                            </div>
                            {db.description && (
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {db.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-3 mt-2 border-t border-slate-100">
                            <span className="flex items-center gap-1 text-slate-700 font-semibold">
                              <Users size={12} className="text-primary" /> {db.contact_count} contact
                              {db.contact_count === 1 ? '' : 's'}
                            </span>
                            <span className="text-[11px]">Ready</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {activeSelectedDb && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">
                      Active: <strong>{activeSelectedDb.name}</strong> ({activeSelectedDb.contact_count} contacts)
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditDatabase(activeSelectedDb)}
                      className="text-primary hover:underline font-semibold"
                    >
                      View / Edit contacts
                    </button>
                  </div>
                )}
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
                    placeholder="e.g. A quick note on streamlining inquiries"
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
                      >
                        {'{business_name}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('contact_name')}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                      >
                        {'{contact_name}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('service')}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                      >
                        {'{service}'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={9}
                    className="input font-sans text-sm leading-relaxed"
                    placeholder="Hi {contact_name},\n\nWrite your message here..."
                    value={body}
                    onChange={e => setBody(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Error Display */}
            <ErrorNote error={error} />

            {/* Actions */}
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
                  onClick={cancelCampaignEdit}
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCampaign('draft')}
                  disabled={pending || !campaignName.trim() || !subject.trim() || !body.trim()}
                  className="btn btn-secondary btn-sm"
                >
                  {pending && <Spinner size={14} />} Save draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveCampaign('draft')
                    setLaunchModalOpen(true)
                  }}
                  disabled={
                    pending ||
                    !campaignName.trim() ||
                    !subject.trim() ||
                    !body.trim() ||
                    !activeSelectedDb ||
                    activeSelectedDb.contact_count === 0
                  }
                  className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={14} /> Review & Launch
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview */}
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            <div className="card p-0 overflow-hidden shadow-sm border border-slate-200">
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
                  <Eye size={12} /> Target: {activeSelectedDb?.name || 'Database'}
                </div>
              </div>

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

              <div className="p-6 bg-white min-h-[300px] flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-extrabold tracking-tight text-slate-900">
                      Selfera<span className="text-primary">.</span>
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                      Outreach
                    </span>
                  </div>

                  <div className="text-sm text-slate-800 leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
                    {previewBody}
                  </div>
                </div>

                <div className="pt-8 mt-6 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
                  <div>Selfera &middot; London, United Kingdom</div>
                  <div>Direct customer engagement & pipeline automation.</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-sky-600" /> Database-Powered
              </div>
              <p className="text-sky-700 leading-normal">
                Emails are sent directly to all <strong>{activeSelectedDb?.contact_count || 0}</strong> contacts in your selected database.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'campaigns' ? (
        /* ------------------------------------------------------------- */
        /* TAB 1: CAMPAIGNS LIST                                         */
        /* ------------------------------------------------------------- */
        <div className="space-y-6">
          <div className="card p-0 overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Your Email Campaigns</h2>
                <p className="text-xs text-slate-500">
                  Campaigns linked to your custom target databases.
                </p>
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
                  <h3 className="font-semibold text-slate-800">No campaigns created yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Select a target database and create your first targeted email campaign.
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

                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium pt-0.5">
                          <span className="flex items-center gap-1 text-slate-700 font-semibold">
                            <Database size={13} className="text-primary" /> Database:{' '}
                            <span className="text-slate-900">{c.database_name || 'Primary'}</span>
                          </span>
                          <span>&middot;</span>
                          <span className="flex items-center gap-1">
                            <Users size={13} /> {c.recipient_count || 0} recipient{c.recipient_count === 1 ? '' : 's'}
                          </span>
                          {c.sent_at && (
                            <>
                              <span>&middot;</span>
                              <span>Sent {new Date(c.sent_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
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
                          onClick={() => setDeleteCampaignId(c.id)}
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
      ) : (
        /* ------------------------------------------------------------- */
        /* TAB 2: TARGET DATABASES MANAGER                               */
        /* ------------------------------------------------------------- */
        <div className="space-y-6">
          <div className="card p-0 overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Your Target Databases</h2>
                <p className="text-xs text-slate-500">
                  Custom contact lists created in the system to run campaigns against.
                </p>
              </div>
              <button
                onClick={openCreateDatabase}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                <Plus size={15} /> Create Database
              </button>
            </div>

            {databases.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Database size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800">No databases created yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Create a database by picking pipeline leads or pasting email lists.
                  </p>
                </div>
                <button
                  onClick={openCreateDatabase}
                  className="btn btn-primary btn-sm mx-auto flex items-center gap-1.5"
                >
                  <Plus size={15} /> Create Database
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {databases.map(db => (
                  <div
                    key={db.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 truncate">{db.name}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                          {db.contact_count} contact{db.contact_count === 1 ? '' : 's'}
                        </span>
                      </div>
                      {db.description && (
                        <p className="text-xs text-slate-500">{db.description}</p>
                      )}
                      <div className="text-xs text-slate-400 pt-1 flex items-center gap-2">
                        <span>Created {new Date(db.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedDatabaseId(db.id)
                          startNewCampaign()
                        }}
                        className="btn btn-primary btn-sm flex items-center gap-1.5"
                      >
                        <Mail size={13} /> Run Campaign
                      </button>
                      <button
                        onClick={() => openEditDatabase(db)}
                        className="btn btn-secondary btn-sm flex items-center gap-1.5"
                      >
                        <Edit3 size={13} /> Edit Contacts
                      </button>
                      <button
                        onClick={() => setDeleteDbId(db.id)}
                        className="btn btn-ghost btn-sm text-slate-400 hover:text-rose-600"
                        title="Delete database"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CREATE / EDIT DATABASE                                 */}
      {/* ------------------------------------------------------------- */}
      {dbModalOpen && (
        <Modal
          title={editingDb ? `Edit Database: ${editingDb.name}` : 'Create Target Database'}
          open
          onClose={() => setDbModalOpen(false)}
          wide
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Database Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. London Boutique Hotels, Q4 Cafes"
                  value={dbName}
                  onChange={e => setDbName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Description (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Accounts targeted for website and booking automation"
                  value={dbDescription}
                  onChange={e => setDbDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Contacts Management in Database */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">Database Contacts</h4>
                  <p className="text-xs text-slate-500">
                    Currently <strong>{dbContacts.length}</strong> contact{dbContacts.length === 1 ? '' : 's'} in this database.
                  </p>
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAddMode('pick')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      addMode === 'pick'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Select from Pipeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('paste')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      addMode === 'paste'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Paste / Quick Add
                  </button>
                </div>
              </div>

              {/* Mode A: Select from Pipeline */}
              {addMode === 'pick' ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search pipeline leads with email..."
                      className="input !text-xs !py-1.5 !pl-8"
                      value={leadPickerSearch}
                      onChange={e => setLeadPickerSearch(e.target.value)}
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 text-xs">
                    {filteredPipelineLeads.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">No matching leads found with email.</div>
                    ) : (
                      filteredPipelineLeads.map(lead => {
                        const inDb = dbContacts.some(
                          c => c.email.toLowerCase() === lead.email.toLowerCase()
                        )
                        return (
                          <div
                            key={lead.id}
                            onClick={() => togglePipelineContact(lead)}
                            className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={inDb}
                                onChange={() => {}}
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
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {lead.category || ''}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Mode B: Paste */
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-xs text-slate-500">
                    Paste contacts (one per line). Format: <code>Business Name, email@domain.com, Contact Name</code> or simply <code>email@domain.com</code>
                  </p>
                  <textarea
                    rows={4}
                    className="input font-mono !text-xs"
                    placeholder="Grand Hotel, manager@grandhotel.co.uk, John Doe&#10;Cafe Nero, hello@cafenero.com"
                    value={pasteInput}
                    onChange={e => setPasteInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAddPastedContacts}
                    disabled={!pasteInput.trim()}
                    className="btn btn-secondary btn-sm"
                  >
                    Add to database contacts
                  </button>
                </div>
              )}

              {/* Current Contacts List inside Database */}
              {dbContacts.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Current Database Members ({dbContacts.length}):
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs">
                    {dbContacts.map(c => (
                      <div
                        key={c.email}
                        className="p-2 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800">
                            {c.business_name || 'Business'}
                          </span>
                          <span className="text-slate-400 ml-2 font-mono text-[11px]">
                            {c.email}
                          </span>
                          {c.contact_name && (
                            <span className="text-slate-500 ml-1 text-[11px]">
                              ({c.contact_name})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContactFromDb(c.email)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ErrorNote error={dbError} />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDbModalOpen(false)}
                disabled={dbPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm flex items-center gap-1.5"
                disabled={dbPending || !dbName.trim() || dbContacts.length === 0}
                onClick={handleSaveDatabase}
              >
                {dbPending && <Spinner size={14} />} Save Database
              </button>
            </div>
          </div>
        </Modal>
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
                      setIsCreatingCampaign(false)
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  Please review the campaign summary before launching:
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Campaign Name:</span>
                    <span className="font-semibold text-slate-800">{campaignName || editingCampaign?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Database:</span>
                    <span className="font-bold text-slate-900">
                      {activeSelectedDb?.name || editingCampaign?.database_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Contacts:</span>
                    <span className="font-bold text-primary">
                      {activeSelectedDb?.contact_count || editingCampaign?.recipient_count || 0} contacts
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
                  This will dispatch outbound emails to all contacts in your target database.
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
      {/* MODAL: DELETE CAMPAIGN CONFIRMATION                           */}
      {/* ------------------------------------------------------------- */}
      {deleteCampaignId && (
        <Modal
          title="Delete Campaign"
          open
          onClose={() => setDeleteCampaignId(null)}
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
                onClick={() => setDeleteCampaignId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() => handleDeleteCampaign(deleteCampaignId)}
              >
                {pending && <Spinner size={14} />} Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DELETE DATABASE CONFIRMATION                           */}
      {/* ------------------------------------------------------------- */}
      {deleteDbId && (
        <Modal
          title="Delete Target Database"
          open
          onClose={() => setDeleteDbId(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this target database? Campaigns already sent will keep their records.
            </p>
            <ErrorNote error={error} />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleteDbId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() => handleDeleteDatabase(deleteDbId)}
              >
                {pending && <Spinner size={14} />} Delete Database
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
