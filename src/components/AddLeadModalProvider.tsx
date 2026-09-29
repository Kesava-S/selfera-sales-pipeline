'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { AddLeadModal } from '@/components/AddLeadModal'

interface OpenModalOptions {
  defaultCompany?: string
  onSuccess?: (newLeadId: string) => void
}

interface AddLeadContextType {
  openAddLeadModal: (options?: OpenModalOptions) => void
  closeAddLeadModal: () => void
  isAddLeadModalOpen: boolean
}

const AddLeadContext = createContext<AddLeadContextType>({
  openAddLeadModal: () => {},
  closeAddLeadModal: () => {},
  isAddLeadModalOpen: false,
})

export const useAddLeadModal = () => useContext(AddLeadContext)

export function AddLeadModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultCompany, setDefaultCompany] = useState<string>('')
  const [onSuccessCallback, setOnSuccessCallback] = useState<((leadId: string) => void) | null>(null)

  const openAddLeadModal = useCallback((options?: OpenModalOptions) => {
    setDefaultCompany(options?.defaultCompany || '')
    setOnSuccessCallback(() => options?.onSuccess || null)
    setIsOpen(true)
  }, [])

  const closeAddLeadModal = useCallback(() => {
    setIsOpen(false)
    setDefaultCompany('')
    setOnSuccessCallback(null)
  }, [])

  const handleSuccess = useCallback(
    (leadId: string) => {
      if (onSuccessCallback) {
        onSuccessCallback(leadId)
      }
    },
    [onSuccessCallback]
  )

  // Listen for global custom event if needed
  useEffect(() => {
    const handleCustomEvent = (e: CustomEvent<OpenModalOptions>) => {
      openAddLeadModal(e.detail)
    }
    window.addEventListener('open-add-lead-modal' as unknown as keyof WindowEventMap, handleCustomEvent as EventListener)
    return () => {
      window.removeEventListener('open-add-lead-modal' as unknown as keyof WindowEventMap, handleCustomEvent as EventListener)
    }
  }, [openAddLeadModal])

  return (
    <AddLeadContext.Provider
      value={{
        openAddLeadModal,
        closeAddLeadModal,
        isAddLeadModalOpen: isOpen,
      }}
    >
      {children}
      <AddLeadModal
        isOpen={isOpen}
        onClose={closeAddLeadModal}
        defaultCompany={defaultCompany}
        onSuccess={handleSuccess}
      />
    </AddLeadContext.Provider>
  )
}
