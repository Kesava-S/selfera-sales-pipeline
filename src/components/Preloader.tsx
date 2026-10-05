import React from 'react'
import { Loader2 } from 'lucide-react'

export function Preloader({
  fullScreen = false,
  className = '',
}: {
  label?: string
  fullScreen?: boolean
  className?: string
}) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-5 ${className}`}>
      <div className="flex h-16 w-16 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Selfera Logo"
          width={56}
          height={56}
          className="h-14 w-14 object-contain select-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#0284c7] selfera-dot-1" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#0284c7] selfera-dot-2" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#0284c7] selfera-dot-3" />
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white animate-fadeIn">
        <div className="relative z-10 flex items-center justify-center">
          {content}
        </div>
      </div>
    )
  }

  return content
}

export const LogoPreloader = Preloader

export function ButtonSpinner({
  size = 15,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <Loader2
      size={size}
      className={`animate-spin shrink-0 text-current ${className}`}
      aria-hidden="true"
    />
  )
}

export function CircleLoader({
  size = 28,
  text,
  fullArea = false,
  className = '',
}: {
  size?: number
  text?: string
  fullArea?: boolean
  className?: string
}) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-2.5 text-slate-500 ${className}`}>
      <Loader2 size={size} className="animate-spin text-sky-600 shrink-0" />
      {text && <span className="text-xs font-medium text-slate-500">{text}</span>}
    </div>
  )

  if (fullArea) {
    return (
      <div className="flex min-h-[180px] w-full items-center justify-center py-8">
        {content}
      </div>
    )
  }

  return content
}
