'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  MessageSquare,
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
  BarChart3,
  Phone,
} from 'lucide-react'
import { CONFIG } from '@/lib/config'
import { formatDate } from '@/lib/format'
import {
  saveWhatsAppCampaign,
  deleteWhatsAppCampaign,
  saveWhatsAppDatabase,
  deleteWhatsAppDatabase,
  sendTestWhatsAppCampaign,
  launchWhatsAppCampaign,
  type WhatsAppCampaignInput,
  type WhatsAppDatabaseInput,
} from '@/app/dashboard/actions'
import { Modal, useAction, ErrorNote, Spinner, toast } from '@/components/ui'
import { CampaignProgress } from '@/components/v2/CampaignProgress'

export type DatabaseContact = {
  id?: string
  business_name: string
  whatsapp_number: string
  contact_name?: string | null
  category?: string | null
  business_type?: string | null
}

export type WhatsAppDatabaseRow = {
  id: string
  name: string
  description: string | null
  contacts: DatabaseContact[]
  contact_count: number
  created_at: string
}

export type WhatsAppCampaignRow = {
  id: string
  name: string
  message: string
  template_name: string | null
  service: string
  database_id: string | null
  database_name: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'archived'
  recipient_count: number
  recipients: DatabaseContact[]
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

export type WhatsAppTemplate = {
  id: string
  name: string
  body: string
  whatsapp_template_name?: string | null
}

export type PipelineLead = {
  id: string
  business_name: string
  contact_name: string | null
  whatsapp_number: string | null
  category: string | null
  business_type: string | null
}

const SERVICES = ['General', ...CONFIG.SERVICES]

export function WhatsAppCampaignsView({
  campaigns: initialCampaigns,
  databases: initialDatabases,
  pipelineLeads,
  templates,
  isApiConfigured,
}: {
  campaigns: WhatsAppCampaignRow[]
  databases: WhatsAppDatabaseRow[]
  pipelineLeads: PipelineLead[]
  templates: WhatsAppTemplate[]
  isApiConfigured: boolean
}) {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'databases'>('campaigns')
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignRow[]>(initialCampaigns)
  const [databases, setDatabases] = useState<WhatsAppDatabaseRow[]>(initialDatabases)

  // Campaign Form State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<WhatsAppCampaignRow | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [service, setService] = useState('General')
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>(
    initialDatabases[0]?.id || ''
  )
  const [message, setMessage] = useState('')

  // Database Creation / Edit Modal
  const [dbModalOpen, setDbModalOpen] = useState(false)
  const [editingDb, setEditingDb] = useState<WhatsAppDatabaseRow | null>(null)
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
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testSentSuccess, setTestSentSuccess] = useState(false)

  // Launch modal
  const [launchModalOpen, setLaunchModalOpen] = useState(false)
  const [activeLaunchCampaign, setActiveLaunchCampaign] = useState<WhatsAppCampaignRow | null>(null)
  const [launchSuccessInfo, setLaunchSuccessInfo] = useState<{ id: string; queued: number; skipped: number; removed: number } | null>(null)
  // Campaign whose delivery report is open
  const [reportCampaignId, setReportCampaignId] = useState<string | null>(null)

  const { run, pending, isPending, error } = useAction()
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
    setMessage(
      'Hi {contact_name},\n\nI noticed the great work {business_name} is doing.\n\nWe help businesses streamline customer bookings, follow ups, and inquiries into a unified queue so you never miss a client.\n\nWould you be open to a quick 5-minute chat this week?\n\nBest regards,\nSelfera Team'
    )
    setIsCreatingCampaign(true)
  }

  // Edit existing campaign
  const startEditCampaign = (c: WhatsAppCampaignRow) => {
    setEditingCampaign(c)
    setCampaignName(c.name)
    setService(c.service || 'General')
    setSelectedDatabaseId(c.database_id || databases[0]?.id || '')
    setMessage(c.message)
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
  const openEditDatabase = (db: WhatsAppDatabaseRow) => {
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

      // Support: "business_name, whatsapp_number, contact_name" or "number" or "business, number"
      const parts = line.split(',').map(p => p.trim())
      let whatsapp_number = ''
      let business_name = ''
      let contact_name = ''

      if (parts.length === 1) {
        whatsapp_number = parts[0]
        business_name = 'Business'
      } else if (parts.length === 2) {
        business_name = parts[0]
        whatsapp_number = parts[1]
      } else {
        business_name = parts[0]
        whatsapp_number = parts[1]
        contact_name = parts[2]
      }

      // Basic cleanup
      const cleanPhone = whatsapp_number.replace(/[^\d+]/g, '')
      if (cleanPhone.length >= 7) {
        added.push({
          business_name: business_name || 'Business',
          whatsapp_number: cleanPhone,
          contact_name: contact_name || null,
        })
      }
    }

    if (added.length > 0) {
      setDbContacts(prev => [...prev, ...added])
      setPasteInput('')
      toast.success(`Added ${added.length} contact(s) to database draft.`)
    } else {
      toast.error('No valid phone numbers found in input.')
    }
  }

  // Toggle contact from pipeline
  const togglePipelineContact = (lead: PipelineLead) => {
    if (!lead.whatsapp_number) return
    const phone = lead.whatsapp_number
    setDbContacts(prev => {
      const exists = prev.some(c => c.whatsapp_number === phone)
      if (exists) {
        return prev.filter(c => c.whatsapp_number !== phone)
      } else {
        return [
          ...prev,
          {
            id: lead.id,
            business_name: lead.business_name,
            whatsapp_number: phone,
            contact_name: lead.contact_name,
            category: lead.category,
            business_type: lead.business_type,
          },
        ]
      }
    })
  }

  const removeContactFromDb = (whatsapp_number: string) => {
    setDbContacts(prev => prev.filter(c => c.whatsapp_number !== whatsapp_number))
  }

  // Save database handler
  const handleSaveDatabase = () => {
    const payload: WhatsAppDatabaseInput = {
      id: editingDb?.id || null,
      name: dbName,
      description: dbDescription.trim() || null,
      contacts: dbContacts,
    }

    runDb(
      () => saveWhatsAppDatabase(payload),
      data => {
        if (data?.id) {
          const newDbRow: WhatsAppDatabaseRow = {
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
          toast.success('Database saved successfully.')
        }
      }
    )
  }

  // Delete database handler
  const handleDeleteDatabase = (id: string) => {
    run(
      () => deleteWhatsAppDatabase(id),
      () => {
        setDatabases(prev => prev.filter(d => d.id !== id))
        if (selectedDatabaseId === id) {
          setSelectedDatabaseId(databases.find(d => d.id !== id)?.id || '')
        }
        setDeleteDbId(null)
        toast.success('Database deleted successfully.')
      }
    )
  }

  // Insert variable tag into body
  const insertVariable = (tag: string) => {
    setMessage(prev => prev + ` {${tag}}`)
  }

  // Apply template
  const applyTemplate = (tId: string) => {
    const t = templates.find(item => item.id === tId)
    if (!t) return
    setMessage(t.body)
  }

  // Sample lead for live preview
  const sampleLead = useMemo(() => {
    if (activeSelectedDb && activeSelectedDb.contacts.length > 0) {
      return activeSelectedDb.contacts[0]
    }
    return {
      business_name: 'The Crown Hotel',
      contact_name: 'Alex Morgan',
      whatsapp_number: '+44 7960 722425',
    }
  }, [activeSelectedDb])

  // Formatted preview content
  const previewMessage = useMemo(() => {
    return (message || 'Type your message body on the left to see live preview...')
      .replace(/\{business_name\}/g, sampleLead.business_name || 'your business')
      .replace(/\{contact_name\}/g, sampleLead.contact_name || 'there')
      .replace(/\{service\}/g, service || 'our services')
  }, [message, sampleLead, service])

  // Save campaign handler
  // onSaved runs only after the server confirms (used by Review & Launch)
  const handleSaveCampaign = (status: 'draft' | 'scheduled' = 'draft', onSaved?: (row: WhatsAppCampaignRow) => void) => {
    const db = activeSelectedDb
    const recipients = db?.contacts || []

    const payload: WhatsAppCampaignInput = {
      id: editingCampaign?.id || null,
      name: campaignName,
      message,
      service,
      databaseId: db?.id || null,
      databaseName: db?.name || 'Custom Database',
      status,
      recipientCount: recipients.length,
      recipients: recipients.map(r => ({
        id: r.id || r.whatsapp_number,
        business_name: r.business_name,
        contact_name: r.contact_name || null,
        whatsapp_number: r.whatsapp_number,
      })),
    }

    run(
      () => saveWhatsAppCampaign(payload),
      data => {
        if (data?.id) {
          const updatedCampaign: WhatsAppCampaignRow = {
            id: data.id,
            name: payload.name,
            message: payload.message,
            template_name: null,
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
          toast.success(status === 'draft' ? 'Campaign draft saved.' : 'Campaign saved.')
          onSaved?.(updatedCampaign)
        }
      },
      { key: onSaved ? 'save-launch' : 'save-draft' }
    )
  }

  // Execute launch
  const executeLaunch = (cId: string) => {
    runLaunch(
      () => launchWhatsAppCampaign(cId),
      data => {
        if (data) {
          setLaunchSuccessInfo({ id: cId, ...data })
          setCampaigns(prev =>
            prev.map(c => (c.id === cId ? { ...c, status: 'sending', sent_at: null, recipient_count: data.queued } : c))
          )
          toast.success(`Campaign launched. Sending to ${data.queued} recipient${data.queued === 1 ? '' : 's'}.`)
        }
      }
    )
  }

  // Keep the list in step with the live progress (sending -> sent)
  const updateCampaignStatus = useCallback((id: string, status: string) => {
    setCampaigns(prev =>
      prev.map(c =>
        c.id === id && c.status !== status
          ? { ...c, status: status as WhatsAppCampaignRow['status'], sent_at: status === 'sent' ? c.sent_at || new Date().toISOString() : c.sent_at }
          : c
      )
    )
  }, [])


  // Delete campaign
  const handleDeleteCampaign = (id: string) => {
    run(
      () => deleteWhatsAppCampaign(id),
      () => {
        setCampaigns(prev => prev.filter(c => c.id !== id))
        setDeleteCampaignId(null)
        toast.success('Campaign deleted.')
      }
    )
  }

  // Filtered pipeline leads for modal picker
  const filteredPipelineLeads = useMemo(() => {
    const leadsWithPhone = pipelineLeads.filter(l => Boolean(l.whatsapp_number))
    if (!leadPickerSearch.trim()) return leadsWithPhone
    const q = leadPickerSearch.toLowerCase()
    return leadsWithPhone.filter(
      l =>
        l.business_name.toLowerCase().includes(q) ||
        (l.whatsapp_number && l.whatsapp_number.includes(q)) ||
        (l.contact_name && l.contact_name.toLowerCase().includes(q))
    )
  }, [pipelineLeads, leadPickerSearch])

  return (
    <div className="space-y-6">
      {/* Top Banner / Header (Identical to Email Campaigns) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">WhatsApp Campaigns</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                isApiConfigured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isApiConfigured ? 'WhatsApp Cloud API' : 'Simulated Mode'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Organize custom target databases and run simple, personalized WhatsApp campaigns.
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
                  <label className="label">
                    Campaign Name <span className="text-red-500 font-bold ml-0.5">*</span>
                  </label>
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
                  <h2 className="font-semibold text-base text-slate-900">
                    Select Target Database <span className="text-red-500 font-bold ml-0.5">*</span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={openCreateDatabase}
                  className="text-xs font-semibold text-primary hover:opacity-75 transition-opacity flex items-center gap-1"
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
                      className="text-primary hover:opacity-75 transition-opacity font-semibold"
                    >
                      View / Edit contacts
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: WhatsApp Content */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    3
                  </span>
                  <h2 className="font-semibold text-base text-slate-900">WhatsApp Message</h2>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label !mb-0">
                      Message Body <span className="text-red-500 font-bold ml-0.5">*</span>
                    </label>
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
                    placeholder="Hi {contact_name},\n\nWrite your WhatsApp message here..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
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
                onClick={() => setTestModalOpen(true)}
                disabled={!message.trim()}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-slate-700"
              >
                <Send size={14} /> Send test message
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
                  disabled={pending || !campaignName.trim() || !message.trim()}
                  className="btn btn-secondary btn-sm"
                >
                  {isPending('save-draft') && <Spinner size={14} />} Save draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveCampaign('draft', row => {
                      setActiveLaunchCampaign(row)
                      setLaunchModalOpen(true)
                    })
                  }}
                  disabled={
                    pending ||
                    !campaignName.trim() ||
                    !message.trim() ||
                    !activeSelectedDb ||
                    activeSelectedDb.contact_count === 0
                  }
                  className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
                >
                  {isPending('save-launch') ? <Spinner size={14} /> : <Sparkles size={14} />} Review & Launch
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview (Matched to Email Campaigns View with Phone/Chat Layout) */}
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            <div className="card p-0 overflow-hidden shadow-sm border border-slate-200">
              <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 ml-2">WhatsApp Preview</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
                  <Eye size={12} /> Target: {activeSelectedDb?.name || 'Database'}
                </div>
              </div>

              {/* Recipient Header Info */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-2 text-xs">
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 w-16 shrink-0 font-medium">To:</span>
                  <span className="font-semibold text-slate-800">
                    {sampleLead.contact_name ? `${sampleLead.contact_name} ` : ''}
                    &lt;{sampleLead.whatsapp_number}&gt;
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 w-16 shrink-0 font-medium">Business:</span>
                  <span className="text-slate-700 font-medium">{sampleLead.business_name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 w-16 shrink-0 font-medium">Channel:</span>
                  <span className="font-medium text-emerald-700 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> WhatsApp Cloud API
                  </span>
                </div>
              </div>

              {/* Message Chat Bubble */}
              <div className="p-6 bg-[#efeae2]/60 min-h-[300px] flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <span className="rounded-md bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-xs uppercase tracking-wider">
                      Today &middot; Live Broadcast Preview
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-[#d9fdd3] p-3.5 text-xs text-slate-900 shadow-xs border border-emerald-200/60 space-y-2">
                      <div className="whitespace-pre-wrap leading-relaxed font-sans text-slate-800">
                        {previewMessage}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 pt-0.5">
                        <span>12:45 PM</span>
                        <span className="text-sky-600 font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 mt-6 border-t border-slate-200/60 text-[11px] text-slate-400 space-y-1">
                  <div>Selfera &middot; London, United Kingdom</div>
                  <div>Direct customer engagement & pipeline automation.</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600" /> Database-Powered Broadcast
              </div>
              <p className="text-emerald-700 leading-normal">
                WhatsApp messages are sent directly to all <strong>{activeSelectedDb?.contact_count || 0}</strong> contacts in your selected database.
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
                <h2 className="font-semibold text-slate-900">Your WhatsApp Campaigns</h2>
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
                  <MessageSquare size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-800">No campaigns created yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Select a target database and create your first targeted WhatsApp campaign.
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
                  const isSending = c.status === 'sending'
                  const launched = isSent || isSending
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
                                : isSending
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {isSent ? 'Sent' : isSending ? 'Sending' : 'Draft'}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            &middot; {c.service}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 line-clamp-1">
                          <span className="font-medium text-slate-700">Message:</span> {c.message}
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
                              <span>Sent {formatDate(c.sent_at)}</span>
                            </>
                          )}
                        </div>
                        {isSending && (
                          <div className="pt-1.5">
                            <CampaignProgress compact channel="whatsapp" campaignId={c.id} onStatusChange={status => updateCampaignStatus(c.id, status)} />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {launched && (
                          <button
                            onClick={() => setReportCampaignId(c.id)}
                            className="btn btn-secondary btn-sm flex items-center gap-1.5"
                          >
                            <BarChart3 size={13} /> Report
                          </button>
                        )}
                        {!launched && (
                          <button
                            onClick={() => {
                              setActiveLaunchCampaign(c)
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
                          <Edit3 size={13} /> {launched ? 'View' : 'Edit'}
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
                    Create a database by picking pipeline leads or pasting phone lists.
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
                        <span>Created {formatDate(db.created_at)}</span>
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
                        <MessageSquare size={13} /> Run Campaign
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
                <label className="label">
                  Database Name <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
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
                  placeholder="e.g. Accounts targeted for WhatsApp chat & direct booking outreach"
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
                      placeholder="Search pipeline leads with phone number..."
                      className="input !text-xs !py-1.5 !pl-8"
                      value={leadPickerSearch}
                      onChange={e => setLeadPickerSearch(e.target.value)}
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 text-xs">
                    {filteredPipelineLeads.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">No matching leads found with phone number.</div>
                    ) : (
                      filteredPipelineLeads.map(lead => {
                        const inDb = dbContacts.some(
                          c => c.whatsapp_number === lead.whatsapp_number
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
                                  {lead.whatsapp_number} {lead.contact_name ? `(${lead.contact_name})` : ''}
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
                    Paste contacts (one per line). Format: <code>Business Name, +447123456789, Contact Name</code> or simply <code>+447123456789</code>
                  </p>
                  <textarea
                    rows={4}
                    className="input font-mono !text-xs"
                    placeholder="Grand Hotel, +447960722425, John Doe&#10;Cafe Nero, +447911123456"
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
                        key={c.whatsapp_number}
                        className="p-2 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800">
                            {c.business_name || 'Business'}
                          </span>
                          <span className="text-slate-400 ml-2 font-mono text-[11px]">
                            {c.whatsapp_number}
                          </span>
                          {c.contact_name && (
                            <span className="text-slate-500 ml-1 text-[11px]">
                              ({c.contact_name})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContactFromDb(c.whatsapp_number)}
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
      {/* MODAL: SEND TEST WHATSAPP                                     */}
      {/* ------------------------------------------------------------- */}
      {testModalOpen && (
        <Modal
          title="Send Test WhatsApp Message"
          open
          onClose={() => {
            setTestModalOpen(false)
            setTestSentSuccess(false)
          }}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Send a test copy to verify how the message format, emojis, and line breaks look directly on WhatsApp.
            </p>

            <div>
              <label className="label">
                Send Test To Phone Number <span className="text-red-500 font-bold ml-0.5">*</span>
              </label>
              <input
                type="tel"
                className="input"
                placeholder="+44 7960 722425"
                value={testPhone}
                onChange={e => {
                  setTestPhone(e.target.value)
                  setTestSentSuccess(false)
                }}
              />
            </div>

            {testSentSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                Test message sent successfully! Check WhatsApp.
              </div>
            )}

            <ErrorNote error={testError} />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setTestModalOpen(false)
                  setTestSentSuccess(false)
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm flex items-center gap-1.5"
                disabled={testPending || testPhone.trim().length < 6}
                onClick={() => {
                  setTestSentSuccess(false)
                  runTest(
                    () =>
                      sendTestWhatsAppCampaign({
                        to: testPhone,
                        message: previewMessage,
                      }),
                    () => {
                      setTestSentSuccess(true)
                      toast.success('Test WhatsApp sent!')
                    }
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
          title="Launch WhatsApp Campaign"
          open
          onClose={() => {
            setLaunchModalOpen(false)
            setLaunchSuccessInfo(null)
          }}
        >
          <div className="space-y-4">
            {launchSuccessInfo ? (
              <div className="space-y-4">
                <CampaignProgress
                  channel="whatsapp"
                  campaignId={launchSuccessInfo.id}
                  onStatusChange={status => updateCampaignStatus(launchSuccessInfo.id, status)}
                />
                {(launchSuccessInfo.skipped > 0 || launchSuccessInfo.removed > 0) && (
                  <p className="text-xs text-slate-500">
                    {launchSuccessInfo.skipped > 0 && `${launchSuccessInfo.skipped} opted out and skipped. `}
                    {launchSuccessInfo.removed > 0 && `${launchSuccessInfo.removed} removed (invalid or duplicate numbers).`}
                  </p>
                )}
                <div className="flex justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
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
                    <span className="font-semibold text-slate-800">{campaignName || activeLaunchCampaign?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Database:</span>
                    <span className="font-bold text-slate-900">
                      {activeSelectedDb?.name || activeLaunchCampaign?.database_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Contacts:</span>
                    <span className="font-bold text-primary">
                      {activeSelectedDb?.contact_count || activeLaunchCampaign?.recipient_count || 0} contacts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service Focus:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[200px]">
                      {service || activeLaunchCampaign?.service}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                  This will dispatch outbound WhatsApp messages to all contacts in your target database.
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
                    disabled={launchPending || !activeLaunchCampaign?.id}
                    onClick={() => {
                      const idToLaunch = activeLaunchCampaign?.id
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
      {reportCampaignId && (
        <Modal title="Delivery report" open onClose={() => setReportCampaignId(null)}>
          <CampaignProgress
            channel="whatsapp"
            campaignId={reportCampaignId}
            onStatusChange={status => updateCampaignStatus(reportCampaignId, status)}
          />
        </Modal>
      )}

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
                disabled={pending}
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
                disabled={pending}
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
