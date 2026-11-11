'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  Sliders,
  Zap,
  RefreshCw,
  Search,
  ChevronRight,
  FlaskConical,
  Radio,
} from 'lucide-react'
import { CHANNELS } from './integrationsData'
import type { ChannelIntegration } from './types'
import { ChannelIcon } from './IntegrationIcons'
import { IntegrationConfigModal } from './IntegrationConfigModal'
import {
  saveIntegrationAction,
  toggleIntegrationAction,
  testIntegrationAction,
} from '@/app/dashboard/actions'
import { toast } from '@/components/ui'

interface IntegrationsViewProps {
  initialChannels?: ChannelIntegration[]
  isAdmin?: boolean
}

export function IntegrationsView({
  initialChannels,
  isAdmin = true,
}: IntegrationsViewProps) {
  const router = useRouter()
  const [channels, setChannels] = useState<ChannelIntegration[]>(initialChannels || CHANNELS)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels
    const q = searchQuery.toLowerCase().trim()
    return channels.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        c.accountInfo.toLowerCase().includes(q)
    )
  }, [channels, searchQuery])

  const handleToggle = async (id: string) => {
    const current = channels.find(c => c.id === id)
    if (!current) return
    const nextStatus = current.status === 'connected' ? 'disconnected' : 'connected'

    setChannels(prev =>
      prev.map(c => (c.id === id ? { ...c, status: nextStatus } : c))
    )

    const res = await toggleIntegrationAction(id)
    if (!res.ok) {
      setChannels(prev =>
        prev.map(c => (c.id === id ? { ...c, status: current.status } : c))
      )
      toast.error(res.error || 'Failed to toggle integration')
    } else {
      toast.success(
        nextStatus === 'connected'
          ? `${current.name} connected`
          : `${current.name} disconnected`
      )
    }
  }

  const handleQuickTest = async (channel: ChannelIntegration) => {
    setTestingId(channel.id)
    const res = await testIntegrationAction(channel.id)
    setTestingId(null)

    if (res.ok) {
      toast.success(res.data?.message || `${channel.name} verified`)
    } else {
      toast.error(res.error || `${channel.name} connection test failed`)
    }
  }

  const handleSave = async (id: string, updatedConfig: Record<string, any>) => {
    const res = await saveIntegrationAction(id, updatedConfig, 'connected')
    if (!res.ok) {
      toast.error(res.error || 'Failed to save configuration.')
      return
    }

    setChannels(prev =>
      prev.map(c => {
        if (c.id === id) {
          let accountInfo = c.accountInfo
          if (id === 'whatsapp') {
            accountInfo = updatedConfig.phone_number_id ? `Phone ID: ${updatedConfig.phone_number_id}` : c.accountInfo
          } else if (id === 'email') {
            accountInfo = updatedConfig.from_email || c.accountInfo
          } else if (id === 'instagram') {
            accountInfo = updatedConfig.username || c.accountInfo
          } else if (id === 'facebook') {
            accountInfo = updatedConfig.page_name || c.accountInfo
          } else if (id === 'linkedin') {
            accountInfo = updatedConfig.client_id ? `Client ID: ${updatedConfig.client_id}` : c.accountInfo
          }

          return {
            ...c,
            config: { ...c.config, ...updatedConfig },
            accountInfo,
            status: 'connected',
          }
        }
        return c
      })
    )
    toast.success(`${channels.find(c => c.id === id)?.name || 'Channel'} saved`)
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Integrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect and manage your sales communication channels.
          </p>
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input !py-1.5 !pl-9 text-sm w-full"
          />
        </div>
      </div>

      {/* Channels List */}
      <div className="card p-0 divide-y divide-slate-100 overflow-hidden shadow-xs border border-slate-200">
        {filteredChannels.map(channel => {
          const isConnected = channel.status === 'connected'
          const isTesting = testingId === channel.id

          return (
            <div
              key={channel.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/dashboard/integrations/${channel.id}`)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(`/dashboard/integrations/${channel.id}`)
                }
              }}
              className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-5 hover:bg-slate-50/70 transition-colors gap-3.5 cursor-pointer select-none focus:outline-hidden focus:bg-slate-50"
            >
              {/* Left: Icon & Channel info */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 group-hover:border-slate-300 transition-colors">
                  <ChannelIcon id={channel.id} size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                      {channel.name}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {channel.provider}
                    </span>
                    {channel.config?.environment === 'sandbox' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <FlaskConical size={11} />
                        <span>Sandbox</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        <Radio size={11} />
                        <span>Realtime</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono truncate mt-0.5">
                    {isConnected ? channel.accountInfo : 'Not configured'}
                  </div>
                </div>
              </div>

              {/* Right: Status & Actions */}
              <div
                className="flex items-center gap-3 shrink-0 self-end sm:self-center"
                onClick={e => e.stopPropagation()}
              >
                {/* Status */}
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                    Not connected
                  </span>
                )}

                {/* Test */}
                {isConnected && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      handleQuickTest(channel)
                    }}
                    disabled={isTesting}
                    className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs"
                    title="Test connection"
                  >
                    {isTesting ? (
                      <RefreshCw size={12} className="animate-spin text-primary" />
                    ) : (
                      <Zap size={12} className="text-amber-500" />
                    )}
                    <span>Test</span>
                  </button>
                )}

                {/* Configure */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    router.push(`/dashboard/integrations/${channel.id}`)
                  }}
                  className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs font-medium"
                >
                  <Sliders size={12} />
                  <span>Configure</span>
                </button>

                {/* Toggle Switch */}
                <label
                  className="relative inline-flex items-center cursor-pointer"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isConnected}
                    onChange={() => handleToggle(channel.id)}
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>

                {/* Chevron icon indicating row is clickable */}
                <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors hidden sm:block" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
