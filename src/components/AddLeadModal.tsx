'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  PlusCircle,
  AlertCircle,
  Building2,
  Tag,
  Briefcase,
  MapPin,
  User,
  Mail,
  Phone,
  Share2,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { CONFIG } from '@/lib/config'

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  defaultCompany?: string
  onSuccess?: (newLeadId: string) => void
}

export function AddLeadModal({
  isOpen,
  onClose,
  defaultCompany = '',
  onSuccess,
}: AddLeadModalProps) {
  const router = useRouter()

  // Form State
  const [businessName, setBusinessName] = useState(defaultCompany)
  const [businessType, setBusinessType] = useState('Cafe')
  const [customType, setCustomType] = useState('')
  const [servicePitched, setServicePitched] = useState<string>(CONFIG.SERVICES[0] || 'Website')
  const [area, setArea] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errors, setErrors] = useState<{
    businessName?: string
    email?: string
    phone?: string
  }>({})

  // Reset or prefill when modal opens
  useEffect(() => {
    if (isOpen) {
      setBusinessName(defaultCompany)
      setBusinessType('Cafe')
      setCustomType('')
      setServicePitched(CONFIG.SERVICES[0] || 'Website')
      setArea('')
      setContactName('')
      setEmail('')
      setPhone('')
      setInstagram('')
      setFacebook('')
      setErrors({})
      setErrorMsg(null)
      setIsSubmitting(false)
      setIsSuccess(false)
    }
  }, [isOpen, defaultCompany])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { businessName?: string; email?: string; phone?: string } = {}

    if (!businessName.trim()) {
      newErrors.businessName = 'Business name is required.'
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setErrorMsg(null)
    setIsSubmitting(true)

    const finalBusinessType = businessType === 'Other' && customType.trim() ? customType.trim() : businessType

    try {
      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          business_type: finalBusinessType,
          service_pitched: servicePitched,
          area: area.trim(),
          contact_name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          instagram: instagram.trim(),
          facebook: facebook.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create lead')
      }

      setIsSuccess(true)
      setTimeout(() => {
        onSuccess?.(data.opportunityId || data.businessId)
        onClose()
        router.refresh()
      }, 500)
    } catch (err: any) {
      console.error('Lead creation error:', err)
      setErrorMsg(err.message || 'Failed to create lead. Please check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center border border-blue-100 dark:border-blue-800/40">
              <PlusCircle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Lead</h2>
              <p className="text-xs text-slate-500">Capture business details and start the sales pipeline.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 flex items-center justify-center mb-3">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lead Successfully Added!</h3>
              <p className="text-sm text-slate-500 mt-1">Opportunity and outreach queue created.</p>
            </div>
          ) : (
            <form id="add-lead-modal-form" onSubmit={handleSubmit} className="space-y-4">
              
              {/* Row 1: Business Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-500" />
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Richmond Hill Bakery"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value)
                    if (errors.businessName) setErrors(prev => ({ ...prev, businessName: undefined }))
                  }}
                  className={`input w-full ${errors.businessName ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                  autoFocus
                />
                {errors.businessName && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.businessName}
                  </p>
                )}
              </div>

              {/* Row 2: Type & Service Pitched */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Tag size={14} className="text-blue-500" />
                    Business Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="input w-full"
                  >
                    {Object.entries(CONFIG.BUSINESS_CATEGORIES).map(([cat, types]) => (
                      <optgroup key={cat} label={cat}>
                        {types.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {businessType === 'Other' && (
                    <input
                      type="text"
                      placeholder="Specify business type..."
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      className="input w-full mt-2"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Briefcase size={14} className="text-blue-500" />
                    Service Pitched <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={servicePitched}
                    onChange={(e) => setServicePitched(e.target.value)}
                    className="input w-full"
                  >
                    {CONFIG.SERVICES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Area / Location & Contact Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <MapPin size={14} className="text-blue-500" />
                    Area / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Richmond, TW9"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User size={14} className="text-blue-500" />
                    Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Row 4: Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail size={14} className="text-blue-500" />
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="contact@business.co.uk"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
                    }}
                    className={`input w-full ${errors.email ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone size={14} className="text-blue-500" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="07453 123456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Row 5: Socials */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Share2 size={14} className="text-blue-500" />
                  Socials
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">Instagram (@handle or URL)</span>
                    <input
                      type="text"
                      placeholder="e.g. richmondhill_bakery"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="input w-full text-sm"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">Facebook / Other Social</span>
                    <input
                      type="text"
                      placeholder="e.g. RichmondHillBakery"
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                      className="input w-full text-sm"
                    />
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Modal Footer */}
        {!isSuccess && (
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-lead-modal-form"
              disabled={isSubmitting}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving Lead...
                </>
              ) : (
                'Add Lead'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
