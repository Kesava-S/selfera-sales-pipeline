'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Compass,
  Search,
  MousePointer,
} from 'lucide-react'
import { useTour } from './TourContext'

export function ProductTour() {
  const {
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
    closeBrowseModal,
  } = useTour()

  const [mounted, setMounted] = useState(false)
  const [spotlightRect, setSpotlightRect] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [isClicking, setIsClicking] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  const cardRef = useRef<HTMLDivElement>(null)

  const triggerClickAnimation = useCallback(() => {
    setIsClicking(true)
    setTimeout(() => setIsClicking(false), 200)
  }, [])

  const cleanupLeadTour = useCallback(() => {
    // Close columns dropdown if open
    const colBtn = document.querySelector('[data-tour="leads-columns-btn"]') as HTMLButtonElement | null
    if (colBtn && colBtn.getAttribute('aria-expanded') === 'true') {
      colBtn.click()
    }

    // Clear selection if selected
    const clearBtn = document.querySelector('[data-tour="bulk-clear"]') as HTMLButtonElement | null
    if (clearBtn) {
      clearBtn.click()
    } else {
      const checkbox = document.querySelector('input[data-tour="leads-table-checkbox"]') as HTMLInputElement | null
      if (checkbox && checkbox.checked) {
        checkbox.click()
      }
    }
  }, [])

  const handleEndTour = useCallback(() => {
    cleanupLeadTour()
    endTour()
  }, [cleanupLeadTour, endTour])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto clean up when tour closes
  useEffect(() => {
    if (!isActive) {
      cleanupLeadTour()
    }
  }, [isActive, cleanupLeadTour])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Position spotlight and animated cursor on active step element, smoothly scrolling up/down
  const updatePositions = useCallback(
    (shouldScroll = false) => {
      if (!isActive || !currentStep) {
        setSpotlightRect(null)
        setCursorPos(null)
        return
      }

      if (window.innerWidth <= 900) {
        setIsMobile(true)
      } else {
        setIsMobile(false)
      }

      const targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement | null
      if (!targetEl) {
        setSpotlightRect(null)
        setCursorPos(null)
        return
      }

      // Smoothly scroll element to center of viewport
      if (shouldScroll) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }

      const rect = targetEl.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const top = Math.max(0, rect.top - 6)
        const left = Math.max(0, rect.left - 6)
        const width = rect.width + 12
        const height = rect.height + 12

        setSpotlightRect({ top, left, width, height })

        // Interaction coordinates for cursor tip
        const cursorX = rect.left + Math.min(36, Math.max(14, rect.width / 4))
        const cursorY = rect.top + Math.min(24, Math.max(12, rect.height / 3))
        setCursorPos({ x: cursorX, y: cursorY })
      } else {
        setSpotlightRect(null)
        setCursorPos(null)
      }
    },
    [isActive, currentStep]
  )

  // Automated interactive actions for modules (e.g. Lead Management tabs & bulk selection)
  useEffect(() => {
    if (!isActive || !currentStep || !activeTour) return

    triggerClickAnimation()

    if (activeTour.id.startsWith('leads')) {
      if (currentStep.id === 'leads-columns') {
        const openTimer = setTimeout(() => {
          const colBtn = document.querySelector('[data-tour="leads-columns-btn"]') as HTMLButtonElement | null
          if (colBtn && colBtn.getAttribute('aria-expanded') !== 'true') {
            colBtn.click()
            updatePositions(true)
          }
        }, 150)
        return () => clearTimeout(openTimer)
      } else {
        // Close columns dropdown if open on any other step
        const colBtn = document.querySelector('[data-tour="leads-columns-btn"]') as HTMLButtonElement | null
        if (colBtn && colBtn.getAttribute('aria-expanded') === 'true') {
          colBtn.click()
        }
      }

      if (currentStep.id === 'leads-table-checkbox') {
        // Wait for row checkbox to be available in the DOM and click it if not checked
        const checkInterval = setInterval(() => {
          const checkbox = document.querySelector('input[data-tour="leads-table-checkbox"]') as HTMLInputElement | null
          if (checkbox) {
            if (!checkbox.checked) {
              checkbox.click()
            }
            clearInterval(checkInterval)
            updatePositions(true)
          }
        }, 120)
        const timeout = setTimeout(() => clearInterval(checkInterval), 3000)

        return () => {
          clearInterval(checkInterval)
          clearTimeout(timeout)
        }
      } else if (
        currentStep.id === 'bulk-assign' ||
        currentStep.id === 'bulk-services' ||
        currentStep.id === 'bulk-archive' ||
        currentStep.id === 'bulk-offtarget' ||
        currentStep.id === 'bulk-delete' ||
        currentStep.id === 'bulk-approve'
      ) {
        // Ensure a row is selected so the bulk bar remains visible
        const checkInterval = setInterval(() => {
          const bulkBar = document.querySelector('[data-tour="bulk-bar"]')
          if (!bulkBar) {
            const checkbox = document.querySelector('input[data-tour="leads-table-checkbox"]') as HTMLInputElement | null
            if (checkbox && !checkbox.checked) {
              checkbox.click()
            }
          } else {
            clearInterval(checkInterval)
            updatePositions(true)
          }
        }, 120)
        const timeout = setTimeout(() => clearInterval(checkInterval), 3000)

        return () => {
          clearInterval(checkInterval)
          clearTimeout(timeout)
        }
      }
    }
  }, [isActive, currentStep, currentStepIndex, activeTour, triggerClickAnimation, updatePositions])

  // Scroll to element and track position on step change
  useEffect(() => {
    if (!isActive || !currentStep) return

    // Center element with smooth scroll
    updatePositions(true)

    // Polling retry while dynamic components mount
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      updatePositions(attempts === 1)
      if (attempts >= 25) {
        clearInterval(interval)
      }
    }, 100)

    const handleUpdate = () => {
      requestAnimationFrame(() => updatePositions(false))
    }

    window.addEventListener('resize', handleUpdate, { passive: true })
    window.addEventListener('scroll', handleUpdate, { passive: true, capture: true })
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
    }
  }, [isActive, currentStep, currentStepIndex, updatePositions])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleEndTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        nextStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStep()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, nextStep, prevStep, handleEndTour])

  if (!mounted) return null

  const filteredModules = allModules.filter(
    m =>
      m.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.subtitle.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.steps.some(
        s =>
          s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
          s.instruction.toLowerCase().includes(searchFilter.toLowerCase())
      )
  )

  const getCardStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        position: 'fixed',
        left: '16px',
        right: '16px',
        bottom: '16px',
        zIndex: 10002,
        width: 'calc(100vw - 32px)',
        maxWidth: '420px',
        margin: '0 auto',
      }
    }

    if (!spotlightRect) {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10002,
        width: '360px',
      }
    }

    const isLarge =
      spotlightRect.height > window.innerHeight * 0.55 ||
      spotlightRect.width > window.innerWidth * 0.75
    if (isLarge) {
      return {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: 10002,
        width: '360px',
      }
    }

    const spaceBelow = window.innerHeight - (spotlightRect.top + spotlightRect.height)
    if (spaceBelow > 240) {
      return {
        position: 'fixed',
        top: `${spotlightRect.top + spotlightRect.height + 14}px`,
        left: `${Math.min(Math.max(20, spotlightRect.left), window.innerWidth - 380)}px`,
        zIndex: 10002,
        width: '360px',
      }
    }

    const spaceAbove = spotlightRect.top
    if (spaceAbove > 240) {
      return {
        position: 'fixed',
        top: `${Math.max(16, spotlightRect.top - 220)}px`,
        left: `${Math.min(Math.max(20, spotlightRect.left), window.innerWidth - 380)}px`,
        zIndex: 10002,
        width: '360px',
      }
    }

    return {
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      zIndex: 10002,
      width: '360px',
    }
  }

  return createPortal(
    <>
      {/* 1. SEPARATE MODULE TOUR WITH ANIMATED CURSOR */}
      {isActive && activeTour && currentStep && (
        <>
          {/* Spotlight SVG Mask */}
          {spotlightRect && (
            <svg
              className="fixed inset-0 pointer-events-none z-[9998] h-full w-full transition-all duration-300 ease-out"
              style={{ width: '100vw', height: '100vh' }}
            >
              <defs>
                <mask id="module-spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect
                    x={spotlightRect.left}
                    y={spotlightRect.top}
                    width={spotlightRect.width}
                    height={spotlightRect.height}
                    rx="12"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(15, 23, 42, 0.55)"
                mask="url(#module-spotlight-mask)"
              />
            </svg>
          )}

          {/* Spotlight highlight ring */}
          {spotlightRect && (
            <div
              style={{
                position: 'fixed',
                top: `${spotlightRect.top}px`,
                left: `${spotlightRect.left}px`,
                width: `${spotlightRect.width}px`,
                height: `${spotlightRect.height}px`,
                borderRadius: '12px',
                zIndex: 9998,
                pointerEvents: 'none',
                transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="ring-4 ring-primary/30"
            />
          )}

          {/* Mobile backdrop fallback */}
          {(isMobile || !spotlightRect) && (
            <div className="fixed inset-0 z-[9998] bg-slate-900/65 backdrop-blur-xs transition-opacity duration-200" />
          )}

          {/* Dismiss backdrop click */}
          <div
            className="fixed inset-0 z-[9997]"
            onClick={handleEndTour}
            aria-hidden="true"
          />

          {/* ANIMATED CURSOR POINTER */}
          {cursorPos && !isMobile && (
            <div
              style={{
                position: 'fixed',
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`,
                transform: isClicking
                  ? 'translate(-2px, -2px) scale(0.85)'
                  : 'translate(-2px, -2px) scale(1)',
                transition:
                  'left 420ms cubic-bezier(0.16, 1, 0.3, 1), top 420ms cubic-bezier(0.16, 1, 0.3, 1), transform 160ms ease-out',
                zIndex: 10001,
                pointerEvents: 'none',
              }}
              className="flex items-center"
            >
              {/* Pulsing Beacon Ring */}
              <span
                className={`absolute -left-2 -top-2 h-7 w-7 rounded-full bg-primary/40 ${
                  isClicking ? 'scale-125 opacity-70' : 'animate-ping'
                }`}
              />
              <span className="absolute -left-1 -top-1 h-5 w-5 rounded-full bg-primary/25" />

              {/* Cursor Pointer Arrow SVG */}
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-lg filter transition-transform duration-150"
              >
                <path
                  d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                  fill="#0F172A"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}

          {/* CONTEXTUAL STEP CARD */}
          <div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${currentStep.title} tour step`}
            style={getCardStyle()}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {React.createElement(activeTour.icon, { size: 15 })}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">
                      {activeTour.title}
                    </span>
                    <span className="text-slate-300">&middot;</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                      {currentStepIndex + 1}/{totalSteps}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEndTour}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Exit tour"
                aria-label="Exit tour"
              >
                <X size={14} />
              </button>
            </div>

            {/* Action Title & 1-line Instruction */}
            <div className="mt-2.5">
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                {currentStep.title}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {currentStep.instruction}
              </p>
            </div>

            {/* Footer with Progress Dots & Navigation */}
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
              <div className="flex items-center gap-1">
                {activeTour.steps.map((st, idx) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => goToStep(idx)}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      idx === currentStepIndex
                        ? 'w-4 bg-primary'
                        : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                    }`}
                    aria-label={`Jump to ${st.title}`}
                    title={`${idx + 1}. ${st.title}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStepIndex === 0}
                  className="btn btn-secondary btn-sm px-2 text-xs font-semibold disabled:opacity-40"
                  aria-label="Previous step"
                >
                  <ChevronLeft size={13} />
                  <span>Back</span>
                </button>

                {currentStepIndex < totalSteps - 1 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="btn btn-primary btn-sm px-2.5 text-xs font-bold flex items-center gap-1"
                    aria-label="Next step"
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEndTour}
                    className="btn btn-primary btn-sm px-2.5 text-xs font-bold flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                    aria-label="Finish tour"
                  >
                    <span>Done</span>
                    <Check size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 2. BROWSE ALL MODULE TOURS MODAL */}
      {browseModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={closeBrowseModal}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="browse-modal-title"
            className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Compass size={20} />
                </div>
                <div>
                  <h2 id="browse-modal-title" className="text-lg font-bold tracking-tight text-slate-900">
                    Module Guides
                  </h2>
                  <p className="text-xs text-slate-500">
                    Each module has its own separate guided tour. Pick a module to begin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBrowseModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mt-4">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="input !py-2 !pl-9 text-xs w-full"
              />
            </div>

            {/* Modules Grid */}
            <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {filteredModules.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No modules match your search filter.
                </div>
              ) : (
                filteredModules.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 transition-all hover:border-primary/40 hover:bg-white hover:shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700">
                        {React.createElement(m.icon, { size: 17 })}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {m.title}
                          </h4>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-500">
                            {m.steps.length} {m.steps.length === 1 ? 'step' : 'steps'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {m.subtitle}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => startTour(m.id)}
                      className="btn btn-secondary btn-sm px-3 text-xs font-semibold shrink-0 flex items-center gap-1.5"
                    >
                      <MousePointer size={12} className="text-primary" />
                      <span>Tour Module</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
