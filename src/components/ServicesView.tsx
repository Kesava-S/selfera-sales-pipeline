'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Layers,
  Plus,
  ArrowRight,
  Edit2,
  Trash2,
  CheckCircle,
} from 'lucide-react'
import type { ExtendedLead, ServiceItem } from '@/types/database'
import { ALL_SERVICES } from '@/types/database'
import { SERVICES_CONFIG, parseComboServices, getServiceMeta } from '@/lib/serviceUtils'
import { ServiceIcon } from '@/components/ServiceBadge'
import { ServiceModal } from '@/components/ServiceModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { createClient } from '@/lib/supabase/client'

// Fallback seed services if database table is just being initialized
const DEFAULT_FALLBACK_SERVICES: ServiceItem[] = ALL_SERVICES.map((srv) => {
  const meta = SERVICES_CONFIG[srv]
  return {
    id: srv,
    name: srv,
    description: meta.description,
    icon_name: meta.iconName,
    color: meta.color,
    deliverables: [],
    is_active: true,
  }
})

interface ServicesViewProps {
  initialLeads?: ExtendedLead[]
  initialServices?: ServiceItem[]
}

export function ServicesView({
  initialLeads = [],
  initialServices = [],
}: ServicesViewProps) {
  const leads = initialLeads

  // Maintain list of services from DB or fallback
  const [services, setServices] = useState<ServiceItem[]>(
    initialServices.length > 0 ? initialServices : DEFAULT_FALLBACK_SERVICES
  )
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modal States
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [deletingService, setDeletingService] = useState<ServiceItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Calculate leads & won deals associated with each service
  const serviceStats = useMemo(() => {
    const stats: Record<string, { totalPitched: number; wonCount: number; leads: ExtendedLead[] }> = {}

    services.forEach((srv) => {
      stats[srv.name.toLowerCase()] = { totalPitched: 0, wonCount: 0, leads: [] }
    })

    leads.forEach((l) => {
      const active = l.current_service || l.initial_service || 'Website Services'
      const parsed = parseComboServices(active)

      parsed.forEach((s) => {
        const key = s.trim().toLowerCase()
        if (!stats[key]) {
          stats[key] = { totalPitched: 0, wonCount: 0, leads: [] }
        }
        stats[key].totalPitched += 1
        if (l.stage === 'Won') {
          stats[key].wonCount += 1
        }
        if (!stats[key].leads.some((item) => item.id === l.id)) {
          stats[key].leads.push(l)
        }
      })
    })

    return stats
  }, [leads, services])

  // Total won deals across all services
  const totalWonDeals = useMemo(() => {
    return leads.filter((l) => l.stage === 'Won').length
  }, [leads])

  // Save (Create or Update) Service
  const handleSaveService = async (serviceData: {
    id?: string
    name: string
    description: string
    icon_name: string
    color: string
    deliverables: string[]
    is_active: boolean
  }) => {
    const supabase = createClient()

    if (serviceData.id) {
      // Update existing service
      const { data, error } = await supabase
        .from('services')
        .update({
          name: serviceData.name,
          description: serviceData.description,
          icon_name: serviceData.icon_name,
          color: serviceData.color,
          deliverables: serviceData.deliverables,
          is_active: serviceData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', serviceData.id)
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      setServices((prev) =>
        prev.map((s) => (s.id === serviceData.id ? (data as ServiceItem) : s))
      )
      showToast(`Service "${serviceData.name}" updated successfully.`)
    } else {
      // Create new service
      const { data, error } = await supabase
        .from('services')
        .insert({
          name: serviceData.name,
          description: serviceData.description,
          icon_name: serviceData.icon_name,
          color: serviceData.color,
          deliverables: serviceData.deliverables,
          is_active: serviceData.is_active,
        })
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      setServices((prev) => [...prev, data as ServiceItem])
      showToast(`Service "${serviceData.name}" created successfully.`)
    }
  }

  // Delete Service
  const handleDeleteService = async () => {
    if (!deletingService) return
    setIsDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', deletingService.id)

      if (error) {
        throw new Error(error.message)
      }

      setServices((prev) => prev.filter((s) => s.id !== deletingService.id))
      showToast(`Service "${deletingService.name}" deleted.`)
      setDeletingService(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting service'
      showToast(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '1.25rem',
            right: '1.75rem',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '0.85rem 1.35rem',
            borderRadius: '12px',
            border: '1px solid #1e293b',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle size={17} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* KPI Metric Cards (Identical to original clean screenshot layout) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div className="card" style={{ padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
            Core Offerings
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {services.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
            Single & multi-service support
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
            Active Lead Pitches
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
            {leads.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
            Total prospects in pipeline
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
            Won Deals
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '0.2rem' }}>
            {totalWonDeals}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
            Successfully closed contracts
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
            Active Catalog
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.2rem' }}>
            {services.filter((s) => s.is_active).length} Active
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
            Available for sales outreach
          </div>
        </div>
      </div>

      {/* Tab Header (Services Catalog only, no logs, with + Add Service action) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              padding: '0.65rem 1.15rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--primary)',
              borderBottom: '2px solid var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-1px',
            }}
          >
            <Layers size={15} />
            <span>Services Catalog ({services.length})</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingService(null)
            setIsServiceModalOpen(true)
          }}
          className="btn btn-primary btn-sm"
          style={{
            padding: '0.4rem 0.9rem',
            fontSize: '0.8125rem',
            borderRadius: '8px',
            gap: '5px',
            marginBottom: '0.4rem',
          }}
        >
          <Plus size={14} />
          <span>Add Service</span>
        </button>
      </div>

      {/* Service Cards Grid (Exact clean design matching user's original screenshot) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        {services.map((srv) => {
          const meta = getServiceMeta(srv.name)
          const statKey = srv.name.toLowerCase()
          const stat = serviceStats[statKey] || { totalPitched: 0, wonCount: 0, leads: [] }
          const cardColor = srv.color || meta.color
          const cardIconName = srv.icon_name || meta.iconName

          return (
            <div
              key={srv.id || srv.name}
              className="card card-hover"
              style={{
                padding: '1.25rem 1.35rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                backgroundColor: '#ffffff',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div>
                {/* Top Row: Icon + Title on left, Badge on right */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ServiceIcon name={cardIconName} size={20} color={cardColor} />
                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        margin: 0,
                        color: cardColor,
                      }}
                    >
                      {srv.name}
                    </h3>
                  </div>
                  <span
                    style={{
                      padding: '0.15rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {stat.totalPitched} {stat.totalPitched === 1 ? 'Lead' : 'Leads'}
                  </span>
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: '0.825rem',
                    color: '#64748b',
                    margin: '0 0 1rem 0',
                    lineHeight: 1.45,
                  }}
                >
                  {srv.description || meta.description}
                </p>

                {/* Pipeline Stats */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontSize: '0.75rem',
                    color: '#475569',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '0.75rem',
                  }}
                >
                  <div>
                    <span style={{ color: '#94a3b8' }}>Pipeline: </span>
                    <strong>{stat.totalPitched} active</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Won Deals: </span>
                    <strong style={{ color: '#059669' }}>{stat.wonCount} won</strong>
                  </div>
                </div>
              </div>

              {/* Card Footer: View Leads & Edit/Delete actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #f8fafc',
                }}
              >
                <Link
                  href={`/leads?search=${encodeURIComponent(srv.name)}`}
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={`View all leads with ${srv.name}`}
                >
                  <span>View associated leads</span>
                  <ArrowRight size={13} />
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingService(srv)
                      setIsServiceModalOpen(true)
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#64748b',
                      gap: '4px',
                    }}
                    title="Edit service details"
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingService(srv)}
                    className="btn btn-ghost btn-sm hover:text-red-600"
                    style={{
                      padding: '0.2rem 0.4rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                    }}
                    title="Delete service offering"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Service Modal */}
      {isServiceModalOpen && (
        <ServiceModal
          isOpen={isServiceModalOpen}
          serviceToEdit={editingService}
          existingNames={services
            .filter((s) => s.id !== editingService?.id)
            .map((s) => s.name)}
          onClose={() => {
            setIsServiceModalOpen(false)
            setEditingService(null)
          }}
          onSave={handleSaveService}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingService && (
        <ConfirmModal
          isOpen={!!deletingService}
          onClose={() => !isDeleting && setDeletingService(null)}
          onConfirm={handleDeleteService}
          title="Delete Service Offering"
          message={`Are you sure you want to delete "${deletingService.name}"? This will remove it from the available service catalog.`}
          confirmText={isDeleting ? 'Deleting...' : 'Delete Service'}
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </div>
  )
}
