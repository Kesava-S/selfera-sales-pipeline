'use client'

import React from 'react'
import {
  Globe,
  LayoutDashboard,
  Cpu,
  Workflow,
  Send,
  ArrowRight,
  Layers,
  Sparkles,
  Shield,
  Zap,
  Rocket,
  Target,
  Server,
  Code,
} from 'lucide-react'
import { getServiceMeta } from '@/lib/serviceUtils'

interface ServiceBadgeProps {
  service?: string | null
  initialService?: string | null
  chain?: string[] | null
  showPivot?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ServiceIcon({
  name,
  service,
  size = 14,
  className,
  color,
}: {
  name?: string
  service?: string
  size?: number
  className?: string
  color?: string
}) {
  const iconName = name || (service ? getServiceMeta(service).iconName : 'Globe')
  const iconColor = color || (service ? getServiceMeta(service).color : undefined)
  const baseStyle: React.CSSProperties = {
    flexShrink: 0,
    display: 'inline-block',
    verticalAlign: 'middle',
    color: iconColor,
  }

  switch (iconName) {
    case 'Globe':
      return <Globe size={size} className={className} style={baseStyle} />
    case 'LayoutDashboard':
      return <LayoutDashboard size={size} className={className} style={baseStyle} />
    case 'Cpu':
      return <Cpu size={size} className={className} style={baseStyle} />
    case 'Workflow':
      return <Workflow size={size} className={className} style={baseStyle} />
    case 'Send':
      return <Send size={size} className={className} style={baseStyle} />
    case 'Layers':
      return <Layers size={size} className={className} style={baseStyle} />
    case 'Sparkles':
      return <Sparkles size={size} className={className} style={baseStyle} />
    case 'Shield':
      return <Shield size={size} className={className} style={baseStyle} />
    case 'Zap':
      return <Zap size={size} className={className} style={baseStyle} />
    case 'Rocket':
      return <Rocket size={size} className={className} style={baseStyle} />
    case 'Target':
      return <Target size={size} className={className} style={baseStyle} />
    case 'Server':
      return <Server size={size} className={className} style={baseStyle} />
    case 'Code':
      return <Code size={size} className={className} style={baseStyle} />
    default:
      return <Layers size={size} className={className} style={baseStyle} />
  }
}

function RenderSingleService({
  serviceName,
  size = 'md',
  isStrikethrough = false,
  isBold = false,
}: {
  serviceName: string
  size?: 'sm' | 'md' | 'lg'
  isStrikethrough?: boolean
  isBold?: boolean
}) {
  const meta = getServiceMeta(serviceName)
  const iconSizes = { sm: 13, md: 15, lg: 17 }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        color: meta.color,
        opacity: isStrikethrough ? 0.65 : 1,
        fontWeight: isBold ? 700 : isStrikethrough ? 500 : 600,
        whiteSpace: 'nowrap',
      }}
      title={meta.description}
    >
      <ServiceIcon name={meta.iconName} size={iconSizes[size]} color={meta.color} />
      <span
        style={{
          textDecoration: isStrikethrough ? 'line-through' : 'none',
          textDecorationStyle: isStrikethrough ? 'dotted' : undefined,
        }}
      >
        {meta.label}
      </span>
    </span>
  )
}

function RenderServiceOrCombo({
  serviceStr,
  size = 'md',
  isStrikethrough = false,
  isBold = false,
}: {
  serviceStr: string
  size?: 'sm' | 'md' | 'lg'
  isStrikethrough?: boolean
  isBold?: boolean
}) {
  const items = serviceStr.split(' + ').map((s) => s.trim()).filter(Boolean)
  if (items.length <= 1) {
    return (
      <RenderSingleService
        serviceName={serviceStr}
        size={size}
        isStrikethrough={isStrikethrough}
        isBold={isBold}
      />
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
      {items.map((srv, idx) => (
        <React.Fragment key={srv + idx}>
          {idx > 0 && <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>+</span>}
          <RenderSingleService
            serviceName={srv}
            size={size}
            isStrikethrough={isStrikethrough}
            isBold={isBold}
          />
        </React.Fragment>
      ))}
    </span>
  )
}

export function ServiceBadge({
  service,
  initialService,
  chain,
  showPivot = false,
  size = 'md',
  className = '',
}: ServiceBadgeProps) {
  const fontSizes = {
    sm: '0.75rem',
    md: '0.8125rem',
    lg: '0.875rem',
  }
  const arrowSizes = { sm: 11, md: 13, lg: 15 }

  // 1. If explicit transition chain is provided and showPivot is enabled
  if (showPivot && chain && chain.length > 1) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: fontSizes[size],
          background: 'transparent',
          flexWrap: 'wrap',
          lineHeight: 1.25,
        }}
      >
        {chain.map((stepService, idx) => {
          const isLast = idx === chain.length - 1
          return (
            <React.Fragment key={stepService + idx}>
              {idx > 0 && (
                <ArrowRight size={arrowSizes[size]} style={{ color: '#94a3b8', flexShrink: 0 }} />
              )}
              <RenderServiceOrCombo
                serviceStr={stepService}
                size={size}
                isStrikethrough={!isLast}
                isBold={isLast}
              />
            </React.Fragment>
          )
        })}
      </span>
    )
  }

  // 2. Fallback to initialService -> current service
  const isPivoted = Boolean(showPivot && initialService && service && initialService !== service)
  if (isPivoted && initialService && service) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: fontSizes[size],
          background: 'transparent',
          whiteSpace: 'nowrap',
          lineHeight: 1.25,
        }}
      >
        <RenderServiceOrCombo
          serviceStr={initialService}
          size={size}
          isStrikethrough={true}
        />
        <ArrowRight size={arrowSizes[size]} style={{ color: '#94a3b8', flexShrink: 0 }} />
        <RenderServiceOrCombo
          serviceStr={service}
          size={size}
          isBold={true}
        />
      </span>
    )
  }

  // 3. Single or Combo active service
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: fontSizes[size],
        background: 'transparent',
        whiteSpace: 'nowrap',
        lineHeight: 1.25,
      }}
    >
      <RenderServiceOrCombo
        serviceStr={service || 'Website Services'}
        size={size}
        isBold={false}
      />
    </span>
  )
}
