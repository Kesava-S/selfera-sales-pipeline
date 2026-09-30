'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  BarChart3,
  Award,
  Users,
  Layers,
  Filter,
  RefreshCw,
  Mail,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Briefcase,
  Target,
} from 'lucide-react'
import { InstagramIcon } from '@/components/Icons'
import type { Lead, PipelineAnalyticsRow, StageType, ChannelType } from '@/types/database'
import { ALL_SERVICES } from '@/types/database'

interface ReportsViewProps {
  initialAnalytics?: PipelineAnalyticsRow[]
  initialLeads?: Lead[]
}

const STAGE_ORDER: StageType[] = ['New', 'Contacted', 'Replied', 'Interested', 'Won']

const STAGE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  New: { bg: '#eff6ff', text: '#2563eb', bar: '#3b82f6' },
  Contacted: { bg: '#f0f9ff', text: '#0284c7', bar: '#0ea5e9' },
  Replied: { bg: '#f5f3ff', text: '#7c3aed', bar: '#8b5cf6' },
  Interested: { bg: '#fffbeb', text: '#d97706', bar: '#f59e0b' },
  Won: { bg: '#ecfdf5', text: '#059669', bar: '#10b981' },
  Lost: { bg: '#fef2f2', text: '#dc2626', bar: '#ef4444' },
  'Do not contact': { bg: '#f1f5f9', text: '#64748b', bar: '#94a3b8' },
}

export function ReportsView({
  initialAnalytics = [],
  initialLeads = [],
}: ReportsViewProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [timeframe, setTimeframe] = useState<'all' | '30d' | '90d'>('all')
  const [selectedService, setSelectedService] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
      if (data) setLeads(data as Lead[])
    } catch (err) {
      console.error('Error refreshing leads:', err)
    } finally {
      setTimeout(() => setIsRefreshing(false), 300)
    }
  }

  // Filtered Leads based on Timeframe and Service
  const filteredLeads = useMemo(() => {
    const now = new Date()
    return leads.filter((lead) => {
      // Service filter
      if (selectedService !== 'all') {
        const srv = lead.current_service || lead.initial_service
        if (srv !== selectedService) return false
      }

      // Timeframe filter
      if (timeframe === '30d') {
        const d = new Date(lead.created_at)
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
        if (diffDays > 30) return false
      } else if (timeframe === '90d') {
        const d = new Date(lead.created_at)
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
        if (diffDays > 90) return false
      }

      return true
    })
  }, [leads, timeframe, selectedService])

  // Aggregate Metrics (Volume & Conversion Only - Zero Financial Pipeline Values)
  const metrics = useMemo(() => {
    const totalLeads = filteredLeads.length
    let wonCount = 0
    let lostCount = 0
    let activeCount = 0
    let totalFollowUps = 0

    filteredLeads.forEach((l) => {
      totalFollowUps += l.follow_up_count || 0

      if (l.stage === 'Won') {
        wonCount++
      } else if (l.stage === 'Lost' || l.stage === 'Do not contact') {
        lostCount++
      } else {
        activeCount++
      }
    })

    const closedCount = wonCount + lostCount
    const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0
    const avgFollowUps = totalLeads > 0 ? (totalFollowUps / totalLeads).toFixed(1) : '0.0'

    return {
      totalLeads,
      wonCount,
      lostCount,
      activeCount,
      winRate: Math.round(winRate * 10) / 10,
      avgFollowUps,
    }
  }, [filteredLeads])

  // Conversion Funnel Data
  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {
      New: 0,
      Contacted: 0,
      Replied: 0,
      Interested: 0,
      Won: 0,
    }

    filteredLeads.forEach((l) => {
      if (counts[l.stage] !== undefined) {
        counts[l.stage]++
      }
    })

    const total = filteredLeads.length || 1
    return STAGE_ORDER.map((stage, idx) => {
      const count = counts[stage] || 0
      const shareOfTotal = Math.round((count / total) * 100)

      // Calculate conversion from previous stage
      let conversionFromPrev = 100
      if (idx > 0) {
        const prevCount = counts[STAGE_ORDER[idx - 1]] || 0
        conversionFromPrev = prevCount > 0 ? Math.min(100, Math.round((count / prevCount) * 100)) : 0
      }

      return {
        stage,
        count,
        shareOfTotal,
        conversionFromPrev,
        color: STAGE_COLORS[stage],
      }
    })
  }, [filteredLeads])

  // Channel Performance Breakdown (Zero Pipeline Values)
  const channelData = useMemo(() => {
    const map: Record<string, { total: number; won: number; lost: number; active: number; touches: number }> = {}
    const channels: ChannelType[] = ['Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in']

    channels.forEach((ch) => {
      map[ch] = { total: 0, won: 0, lost: 0, active: 0, touches: 0 }
    })

    filteredLeads.forEach((l) => {
      const ch = (l.channel in map) ? l.channel : 'Email'
      map[ch].total++
      map[ch].touches += l.follow_up_count || 0

      if (l.stage === 'Won') map[ch].won++
      else if (l.stage === 'Lost' || l.stage === 'Do not contact') map[ch].lost++
      else map[ch].active++
    })

    return channels.map((ch) => {
      const d = map[ch]
      const closed = d.won + d.lost
      const winRate = closed > 0 ? Math.round((d.won / closed) * 100) : d.total > 0 ? Math.round((d.won / d.total) * 100) : 0
      const avgTouches = d.total > 0 ? (d.touches / d.total).toFixed(1) : '0.0'
      return {
        channel: ch,
        ...d,
        winRate,
        avgTouches,
      }
    })
  }, [filteredLeads])

  const renderChannelIcon = (ch: string) => {
    switch (ch) {
      case 'WhatsApp':
        return <MessageCircle size={15} style={{ color: '#16a34a' }} />
      case 'Instagram':
        return <InstagramIcon size={14} />
      case 'Phone':
        return <Phone size={15} style={{ color: '#0284c7' }} />
      case 'Walk-in':
        return <Briefcase size={15} style={{ color: '#7c3aed' }} />
      case 'Email':
      default:
        return <Mail size={15} style={{ color: '#ea580c' }} />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.15rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Pipeline Analytics & Performance
              </h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Conversion velocity, win rates, channel attribution, and sales pipeline metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Timeframe Filter */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '2px',
              fontSize: '0.775rem',
              fontWeight: 600,
            }}
          >
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: timeframe === 'all' ? '#ffffff' : 'transparent',
                color: timeframe === 'all' ? '#0f172a' : '#64748b',
                boxShadow: timeframe === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('90d')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: timeframe === '90d' ? '#ffffff' : 'transparent',
                color: timeframe === '90d' ? '#0f172a' : '#64748b',
                boxShadow: timeframe === '90d' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Last 90d
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('30d')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: timeframe === '30d' ? '#ffffff' : 'transparent',
                color: timeframe === '30d' ? '#0f172a' : '#64748b',
                boxShadow: timeframe === '30d' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Last 30d
            </button>
          </div>

          {/* Service Filter */}
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '0.775rem',
              fontWeight: 500,
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Services</option>
            {ALL_SERVICES.map((srv) => (
              <option key={srv} value={srv}>
                {srv}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '8px',
              fontSize: '0.775rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Refresh analytics data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top 5 KPI Summary Cards (Volume & Conversion Only) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Total Prospects */}
        <div className="card" style={{ padding: '1.25rem', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Prospects
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#eff6ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem', letterSpacing: '-0.02em' }}>
            {metrics.totalLeads}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Across all outreach channels
          </div>
        </div>

        {/* Win Rate */}
        <div className="card" style={{ padding: '1.25rem', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Win Rate
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', marginTop: '0.4rem', letterSpacing: '-0.02em' }}>
            {metrics.winRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            {metrics.wonCount} won vs {metrics.lostCount} lost
          </div>
        </div>

        {/* Active In-Flight Leads */}
        <div className="card" style={{ padding: '1.25rem', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active In-Flight
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#d97706', marginTop: '0.4rem', letterSpacing: '-0.02em' }}>
            {metrics.activeCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Actively progressing in cadence
          </div>
        </div>

        {/* Won Deals Count */}
        <div className="card" style={{ padding: '1.25rem', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Won Deals
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', marginTop: '0.4rem', letterSpacing: '-0.02em' }}>
            {metrics.wonCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '0.2rem' }}>
            Successfully closed deals
          </div>
        </div>

        {/* Follow-up Velocity */}
        <div className="card" style={{ padding: '1.25rem', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Touch Velocity
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem', letterSpacing: '-0.02em' }}>
            {metrics.avgFollowUps}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Avg touches per prospect
          </div>
        </div>
      </div>

      {/* Main Grid: Conversion Funnel (2 Cols) + Stage Breakdown (1 Col) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Conversion Funnel */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Pipeline Conversion Funnel
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Tracking prospect progression from Initial Lead Ingestion to Signed Won deals.
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              {filteredLeads.length} Total Prospects
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {funnelData.map((item, idx) => {
              const maxCount = Math.max(...funnelData.map((f) => f.count), 1)
              const widthPct = Math.max(12, Math.round((item.count / maxCount) * 100))

              return (
                <div
                  key={item.stage}
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    padding: '0.85rem 1.15rem',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: item.color.bg,
                          color: item.color.text,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        {item.stage}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                          {item.count} leads
                        </div>
                      </div>
                      <div
                        style={{
                          minWidth: '55px',
                          textAlign: 'center',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          backgroundColor: item.color.bg,
                          color: item.color.text,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {item.shareOfTotal}%
                      </div>
                    </div>
                  </div>

                  {/* Funnel Progress Bar */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${widthPct}%`,
                        backgroundColor: item.color.bar,
                        borderRadius: '4px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stage Lead Distribution */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#0f172a' }}>
            Stage Distribution
          </h2>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.75rem', color: '#64748b' }}>
            Lead volume allocation across cadence stages.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {funnelData.map((f) => (
              <div
                key={f.stage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: f.color.bar }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>{f.stage}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a' }}>
                    {f.count} leads
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: f.color.text,
                      backgroundColor: f.color.bg,
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    {f.shareOfTotal}%
                  </span>
                </div>
              </div>
            ))}

            {/* Inactive / Drop-off note */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
              <span>Closed / Lost Leads:</span>
              <strong style={{ color: '#dc2626' }}>{metrics.lostCount} deals</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Performance Table & Attribution */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Channel Attribution & Conversion
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              Compare prospect engagement and win rates across outreach channels.
            </p>
          </div>
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Total Ingested</th>
                <th>Active In-Flight</th>
                <th>Won Deals</th>
                <th>Win Rate %</th>
                <th>Avg Touches</th>
              </tr>
            </thead>
            <tbody>
              {channelData.map((ch) => (
                <tr key={ch.channel}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#0f172a' }}>
                      {renderChannelIcon(ch.channel)}
                      <span>{ch.channel}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ch.total}</td>
                  <td>{ch.active}</td>
                  <td>
                    <span style={{ color: ch.won > 0 ? '#059669' : '#64748b', fontWeight: 600 }}>
                      {ch.won}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '50px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, ch.winRate)}%`, backgroundColor: '#10b981' }} />
                      </div>
                      <span style={{ fontSize: '0.775rem', fontWeight: 600, color: ch.winRate > 0 ? '#059669' : '#64748b' }}>
                        {ch.winRate}%
                      </span>
                    </div>
                  </td>
                  <td>{ch.avgTouches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
