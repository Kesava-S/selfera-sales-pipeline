'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { handleSSOLogin } from '@/lib/authUtils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login' || pathname.startsWith('/sso')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Check if token is passed directly in URL (e.g. /?token=...)
    const searchParams = new URLSearchParams(window.location.search)
    const directToken = searchParams.get('token')
    if (directToken) {
      handleSSOLogin(directToken).then((res) => {
        if (res.success) {
          setToast({ message: 'Authentication successful', type: 'success' })
          searchParams.delete('token')
          const cleanUrl = searchParams.toString()
            ? `${window.location.pathname}?${searchParams.toString()}`
            : window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
          setTimeout(() => setToast(null), 4000)
        }
      })
      return
    }

    // 2. Check for pending auth toast from SSO redirection or sessionStorage
    const storedToast = sessionStorage.getItem('selfera_auth_toast')
    const hasSsoSuccess = searchParams.get('sso') === 'success'

    if (storedToast || hasSsoSuccess) {
      if (storedToast) sessionStorage.removeItem('selfera_auth_toast')
      if (hasSsoSuccess) {
        searchParams.delete('sso')
        const cleanUrl = searchParams.toString()
          ? `${window.location.pathname}?${searchParams.toString()}`
          : window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
      }
      setToast({ message: storedToast || 'Authentication successful', type: 'success' })
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [pathname])

  // Support custom toast event across the app
  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type?: 'success' | 'error' }>
      if (customEvent.detail?.message) {
        setToast({
          message: customEvent.detail.message,
          type: customEvent.detail.type || 'success',
        })
        const timer = setTimeout(() => setToast(null), 4000)
        return () => clearTimeout(timer)
      }
    }
    window.addEventListener('selfera_toast', handleCustomToast)
    return () => window.removeEventListener('selfera_toast', handleCustomToast)
  }, [])

  if (isAuthPage) {
    return <main className="auth-shell">{children}</main>
  }

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.25rem',
            right: '1.75rem',
            backgroundColor: toast.type === 'error' ? '#7f1d1d' : '#0f172a',
            color: '#ffffff',
            padding: '0.9rem 1.4rem',
            borderRadius: '12px',
            border: `1px solid ${toast.type === 'error' ? '#991b1b' : '#1e293b'}`,
            boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.2))',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
          ) : (
            <CheckCircle size={18} style={{ color: '#10b981' }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}
