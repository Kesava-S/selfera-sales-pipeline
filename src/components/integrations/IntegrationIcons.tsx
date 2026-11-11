import React from 'react'
import { MessageSquare, Mail, Camera, ThumbsUp, Layers } from 'lucide-react'

const CHANNEL_ICON_COLORS: Record<string, string> = {
  whatsapp: 'text-emerald-600',
  email: 'text-sky-600',
  instagram: 'text-pink-600',
  facebook: 'text-blue-600',
  linkedin: 'text-[#0a66c2]',
  all: 'text-indigo-600',
}

export function ChannelIcon({
  id,
  size = 18,
  className = '',
}: {
  id: string
  size?: number
  className?: string
}) {
  const norm = (id || '').toLowerCase()
  const defaultColor = CHANNEL_ICON_COLORS[norm] || 'text-slate-600'
  const colorCls = className.includes('text-') ? className : `${defaultColor} ${className}`

  switch (norm) {
    case 'whatsapp':
      return <MessageSquare size={size} className={`${colorCls} shrink-0`} />
    case 'email':
      return <Mail size={size} className={`${colorCls} shrink-0`} />
    case 'instagram':
      return <Camera size={size} className={`${colorCls} shrink-0`} />
    case 'facebook':
      return <ThumbsUp size={size} className={`${colorCls} shrink-0`} />
    case 'all':
      return <Layers size={size} className={`${colorCls} shrink-0`} />
    case 'linkedin':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${colorCls} shrink-0`}
        >
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      )
    default:
      return <MessageSquare size={size} className={`${colorCls} shrink-0`} />
  }
}
