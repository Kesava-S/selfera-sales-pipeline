'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
} from 'lucide-react'

import { ConfirmModal } from '@/components/ConfirmModal'
import {
  fetchActiveUserProfile,
  getCachedUserProfile,
  clearCachedUserProfile,
  logoutUser,
  UserProfile,
} from '@/lib/authUtils'

export function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  // Load authenticated user profile
  useEffect(() => {
    let isMounted = true

    const syncUser = async () => {
      // 1. Immediately check cached profile for fast zero-flicker render
      const cached = getCachedUserProfile()
      if (cached && isMounted) {
        setCurrentUser(cached)
      }

      // 2. Fetch fresh profile from Supabase
      const fresh = await fetchActiveUserProfile()
      if (fresh && isMounted) {
        setCurrentUser(fresh)
      }
    }

    syncUser()

    const handleProfileUpdate = () => {
      const updated = getCachedUserProfile()
      if (updated && isMounted) {
        setCurrentUser(updated)
      }
    }

    window.addEventListener('selfera_user_profile_updated', handleProfileUpdate)
    return () => {
      isMounted = false
      window.removeEventListener('selfera_user_profile_updated', handleProfileUpdate)
    }
  }, [pathname])

  const executeSignOut = async () => {
    await logoutUser()
  }

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getBreadcrumbTitle = () => {
    if (pathname === '/') return "Today's Queue"
    if (pathname === '/leads') return 'Leads Directory'
    if (pathname.startsWith('/leads/add')) return 'Add Lead'
    if (pathname.startsWith('/leads/import')) return 'Import CSV'
    if (pathname.startsWith('/leads/')) return 'Lead Overview'
    if (pathname === '/templates') return 'Templates'
    if (pathname === '/reports') return 'Pipeline Analytics'
    if (pathname.startsWith('/company')) return 'Company Workspace'
    if (pathname === '/services') return 'Services'
    if (pathname === '/settings') return 'Cadence Rules'
    return 'Workspace'
  }

  // Show back navigation button on all pages other than the home dashboard root
  const canGoBack = pathname !== '/'

  return (
    <header className="topbar">
      {/* Left: Common Back Button + Location Path Breadcrumbs */}
      <div className="flex items-center gap-2">
        {canGoBack && (
          <button
            onClick={() => router.back()}
            className="btn btn-secondary btn-sm"
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.55rem',
              marginRight: '0.5rem',
              boxShadow: 'var(--shadow-xs)',
            }}
            title="Go back to previous page"
            aria-label="Back"
          >
            <ArrowLeft size={15} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Back</span>
          </button>
        )}

        {/* Hierarchical navigation for subpages */}
        {(pathname.startsWith('/leads/') || pathname.startsWith('/company')) && (
          <>
            <Link
              href="/leads"
              className="text-muted hover:text-foreground font-semibold"
              style={{ fontSize: '0.85rem', textDecoration: 'none' }}
            >
              All Leads
            </Link>
            <ChevronRight size={14} style={{ color: '#94a3b8' }} />
          </>
        )}

        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#0f172a',
            backgroundColor: '#f1f5f9',
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
          }}
        >
          {getBreadcrumbTitle()}
        </span>
      </div>

      {/* Right: Actions & Staff Profile */}
      <div className="flex items-center gap-3">
        {/* User Profile in Topbar */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.3rem 0.65rem 0.3rem 0.35rem',
              backgroundColor: profileOpen ? '#f1f5f9' : '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '9999px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-xs)',
            }}
            title="Account profile and settings"
          >
            {/* Avatar */}
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}
            >
              {currentUser?.initial || 'U'}
            </div>

            {/* User Info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                lineHeight: 1.2,
              }}
            >
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a' }}>
                {currentUser?.full_name || 'User'}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                  }}
                />
                {currentUser?.role_name || 'Staff'}
              </span>
            </div>

            <ChevronDown
              size={14}
              style={{
                color: '#94a3b8',
                marginLeft: '2px',
                transform: profileOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '240px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow:
                  '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                padding: '0.75rem',
                zIndex: 1000,
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <div
                style={{
                  padding: '0.5rem 0.65rem',
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  {currentUser?.full_name || 'User'}
                </div>
                {currentUser?.email && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    {currentUser.email}
                  </div>
                )}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '6px',
                    backgroundColor: '#eff6ff',
                    color: 'var(--primary)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                    }}
                  />
                  Active • {currentUser?.role_name || 'Staff'}
                </div>
              </div>

              {/* Sign Out Button in Dropdown */}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false)
                  setShowSignOutConfirm(true)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  marginTop: '0.5rem',
                  borderTop: '1px solid #f1f5f9',
                  borderBottom: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  background: 'transparent',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: '6px',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={executeSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of your Selfera workspace?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        confirmIcon={<LogOut size={14} />}
      />
    </header>
  )
}
