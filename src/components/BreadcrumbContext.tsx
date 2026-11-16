'use client'

import React, { createContext, useContext, useState, useRef, useCallback } from 'react'

export type BreadcrumbItem = {
  label: string
  href?: string
  onClick?: () => void
}

type BreadcrumbContextType = {
  breadcrumbs: BreadcrumbItem[]
  setBreadcrumbs: (items: BreadcrumbItem[]) => void
  setCustomBack: (fn: (() => boolean | void) | null) => void
  triggerCustomBack: () => boolean
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined)

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const customBackRef = useRef<(() => boolean | void) | null>(null)

  const setCustomBack = useCallback((fn: (() => boolean | void) | null) => {
    customBackRef.current = fn
  }, [])

  const triggerCustomBack = useCallback(() => {
    if (customBackRef.current) {
      const res = customBackRef.current()
      return res !== false
    }
    return false
  }, [])

  return (
    <BreadcrumbContext.Provider value={{ breadcrumbs, setBreadcrumbs, setCustomBack, triggerCustomBack }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext)
  if (!context) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider')
  }
  return context
}
