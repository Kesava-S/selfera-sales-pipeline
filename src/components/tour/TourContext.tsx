'use client'

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  MODULE_TOURS,
  getModuleToursForRole,
  getModuleTourForPath,
  type ModuleTour,
  type TourStep,
} from './tourData'

interface TourContextValue {
  currentModuleTour: ModuleTour | null
  activeTour: ModuleTour | null
  currentStepIndex: number
  currentStep: TourStep | null
  totalSteps: number
  isActive: boolean
  allModules: ModuleTour[]

  startTour: (moduleId?: string) => void
  endTour: () => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (index: number) => void

  browseModalOpen: boolean
  openBrowseModal: () => void
  closeBrowseModal: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({
  userProfile,
  children,
}: {
  userProfile: { id: string; role: string; full_name?: string }
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const allModules = useMemo(() => getModuleToursForRole(userProfile.role), [userProfile.role])

  const [activeTour, setActiveTour] = useState<ModuleTour | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [browseModalOpen, setBrowseModalOpen] = useState(false)

  const activeTourStorageKey = 'selfera_separate_tour_module'
  const [searchString, setSearchString] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSearchString(window.location.search)
    }
  }, [pathname])

  // Determine current page's tour
  const currentModuleTour = useMemo(
    () => getModuleTourForPath(pathname, userProfile.role, searchString),
    [pathname, userProfile.role, searchString]
  )

  const endTour = useCallback(() => {
    setIsActive(false)
    setActiveTour(null)
    setCurrentStepIndex(0)
    try {
      sessionStorage.removeItem(activeTourStorageKey)
    } catch {
      // Ignore
    }
  }, [activeTourStorageKey])

  const startTour = useCallback(
    (moduleId?: string) => {
      setBrowseModalOpen(false)

      let targetModule: ModuleTour | null = null
      if (moduleId) {
        targetModule = allModules.find(m => m.id === moduleId) || null
      }
      if (!targetModule) {
        targetModule = currentModuleTour || allModules[0] || null
      }

      if (!targetModule) return

      // If the selected tour belongs to another page/tab, navigate there first
      const currentFull = pathname + (typeof window !== 'undefined' ? window.location.search : '')
      const isCurrentRoute = targetModule.route.includes('?')
        ? currentFull === targetModule.route
        : pathname === targetModule.route || pathname.startsWith(targetModule.route + '/')

      if (!isCurrentRoute) {
        try {
          sessionStorage.setItem(activeTourStorageKey, targetModule.id)
        } catch {
          // Ignore
        }
        router.push(targetModule.route)
        return
      }

      setActiveTour(targetModule)
      setCurrentStepIndex(0)
      setIsActive(true)
    },
    [allModules, currentModuleTour, pathname, router, activeTourStorageKey]
  )

  // Restore tour after cross-page navigation if initiated from the browse modal
  useEffect(() => {
    try {
      const storedId = sessionStorage.getItem(activeTourStorageKey)
      if (storedId) {
        const matchingModule = allModules.find(m => m.id === storedId)
        if (matchingModule) {
          setActiveTour(matchingModule)
          setCurrentStepIndex(0)
          setIsActive(true)
          sessionStorage.removeItem(activeTourStorageKey)
        }
      }
    } catch {
      // Ignore
    }
  }, [pathname, allModules, activeTourStorageKey])

  const nextStep = useCallback(() => {
    if (!activeTour) return
    if (currentStepIndex < activeTour.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    } else {
      endTour()
    }
  }, [activeTour, currentStepIndex, endTour])

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }, [currentStepIndex])

  const goToStep = useCallback(
    (index: number) => {
      if (activeTour && index >= 0 && index < activeTour.steps.length) {
        setCurrentStepIndex(index)
      }
    },
    [activeTour]
  )

  const openBrowseModal = useCallback(() => {
    setIsActive(false)
    setBrowseModalOpen(true)
  }, [])

  const closeBrowseModal = useCallback(() => {
    setBrowseModalOpen(false)
  }, [])

  const currentStep = activeTour?.steps[currentStepIndex] || null
  const totalSteps = activeTour?.steps.length || 0

  const value = useMemo<TourContextValue>(
    () => ({
      currentModuleTour,
      activeTour,
      currentStepIndex,
      currentStep,
      totalSteps,
      isActive,
      allModules,
      startTour,
      endTour,
      nextStep,
      prevStep,
      goToStep,
      browseModalOpen,
      openBrowseModal,
      closeBrowseModal,
    }),
    [
      currentModuleTour,
      activeTour,
      currentStepIndex,
      currentStep,
      totalSteps,
      isActive,
      allModules,
      startTour,
      endTour,
      nextStep,
      prevStep,
      goToStep,
      browseModalOpen,
      openBrowseModal,
      closeBrowseModal,
    ]
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}
