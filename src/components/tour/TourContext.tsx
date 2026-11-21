'use client'

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
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

  const searchString = useSearchParams().toString()
  const [pendingTourId, setPendingTourId] = useState<string | null>(null)
  const [isNavigating, startNavigation] = useTransition()
  const currentModuleTour = useMemo(
    () => getModuleTourForPath(pathname, userProfile.role, searchString),
    [pathname, userProfile.role, searchString]
  )

  const endTour = useCallback(() => {
    setPendingTourId(null)
    setIsActive(false)
    setActiveTour(null)
    setCurrentStepIndex(0)
  }, [])

  const activateTour = useCallback((tour: ModuleTour) => {
    const steps = tour.steps.filter(step =>
      !step.requiresSelector || document.querySelector(step.requiresSelector)
    )
    if (steps.length === 0) return
    setActiveTour({ ...tour, steps })
    setCurrentStepIndex(0)
    setIsActive(true)
  }, [])

  const startTour = useCallback(
    (moduleId?: string) => {
      setBrowseModalOpen(false)
      const target = moduleId ? allModules.find(tour => tour.id === moduleId) : currentModuleTour
      if (!target) return

      if (target.id === currentModuleTour?.id) {
        setPendingTourId(null)
        activateTour(target)
        return
      }

      setPendingTourId(target.id)
      startNavigation(() => router.push(target.route))
    },
    [allModules, currentModuleTour, activateTour, router]
  )

  useEffect(() => {
    if (isNavigating || !pendingTourId) return
    const frame = requestAnimationFrame(() => {
      setPendingTourId(null)
      if (currentModuleTour?.id === pendingTourId) activateTour(currentModuleTour)
    })
    return () => cancelAnimationFrame(frame)
  }, [isNavigating, pendingTourId, currentModuleTour, activateTour])

  if (activeTour && activeTour.id !== currentModuleTour?.id) {
    setActiveTour(null)
    setCurrentStepIndex(0)
    setIsActive(false)
  }

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
