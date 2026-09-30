'use client'

import React from 'react'
import { Globe, LayoutDashboard, Cpu, Workflow, Send, ArrowRight } from 'lucide-react'
import { getServiceMeta } from '@/lib/serviceUtils'

interface ServiceBadgeProps {
  service?: string | null
  initialService?: string | null
  showPivot?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ServiceIcon({
  name,
  size = 14,
  className,
  color,
}: {
  name: 'Globe' | 'LayoutDashboard' | 'Cpu' | 'Workflow' | 'Send'
  size?: number
  className?: string
  color?: string
}) {
  const style = color ? { color } : undefined
  switch (name) {
    case 'Globe':
      return <Globe size={size} className={className} style={style} />
    case 'LayoutDashboard':
      return <LayoutDashboard size={size} className={className} style={style} />
    case 'Cpu':
      return <Cpu size={size} className={className} style={style} />
    case 'Workflow':
      return <Workflow size={size} className={className} style={style} />
    case 'Send':
      return <Send size={size} className={className} style={style} />
    default:
      return <Globe size={size} className={className} style={style} />
  }
}

export function ServiceBadge({
  service,
  initialService,
  showPivot = false,
  size = 'md',
  className = '',
}: ServiceBadgeProps) {
  const currentMeta = getServiceMeta(service)
  const isPivoted = Boolean(showPivot && initialService && service && initialService !== service)
  const initialMeta = isPivoted ? getServiceMeta(initialService) : null

  const fontSizes = {
    sm: '0.75rem',
    md: '0.8125rem',
    lg: '0.875rem',
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  }

  if (isPivoted && initialMeta) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium ${className}`}
        style={{
          fontSize: fontSizes[size],
          background: 'transparent', // STRICT: No background highlights
        }}
        title={`Initial Pitch: ${initialMeta.label} → Currently: ${currentMeta.label}`}
      >
        <span className="inline-flex items-center gap-1 opacity-70" style={{ color: initialMeta.color }}>
          <ServiceIcon name={initialMeta.iconName} size={iconSizes[size]} color={initialMeta.color} />
          <span className="line-through decoration-dotted">{initialMeta.label}</span>
        </span>
        <ArrowRight size={iconSizes[size] - 2} className="text-muted opacity-60" />
        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: currentMeta.color }}>
          <ServiceIcon name={currentMeta.iconName} size={iconSizes[size]} color={currentMeta.color} />
          <span>{currentMeta.label}</span>
        </span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${className}`}
      style={{
        fontSize: fontSizes[size],
        color: currentMeta.color,
        background: 'transparent', // STRICT: No background highlights
      }}
      title={currentMeta.description}
    >
      <ServiceIcon name={currentMeta.iconName} size={iconSizes[size]} color={currentMeta.color} />
      <span>{currentMeta.label}</span>
    </span>
  )
}
