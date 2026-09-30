'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Layers,
  FileText,
  Sliders,
  LogOut,
  BarChart3,
} from 'lucide-react'

import { ConfirmModal } from '@/components/ConfirmModal'
import {
  fetchActiveUserProfile,
  getCachedUserProfile,
  clearCachedUserProfile,
  logoutUser,
  UserProfile,
} from '@/lib/authUtils'

export function Sidebar() {
  const pathname = usePathname()
  const [openTasksCount, setOpenTasksCount] = useState<number>(0)
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

  useEffect(() => {
    let isMounted = true
    const fetchCount = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const { isDueTodayOrOverdue } = await import('@/lib/dateUtils')
        const supabase = createClient()
        const { data: openTasks, error } = await supabase
          .from('tasks')
          .select('id, due_date, leads(stage, next_follow_up)')
          .eq('status', 'open')
        if (!error && openTasks && isMounted) {
          const dueTodayCount = openTasks.filter((t) => {
            if (!isDueTodayOrOverdue(t.due_date)) return false
            const leadStage = (t.leads as { stage?: string; next_follow_up?: string } | null)?.stage
            if (leadStage && ['Replied', 'Lost', 'Do not contact'].includes(leadStage)) return false
            const nextFollowUp = (t.leads as { stage?: string; next_follow_up?: string } | null)?.next_follow_up
            if (leadStage === 'Interested' && nextFollowUp && t.due_date !== nextFollowUp) return false
            return true
          }).length
          setOpenTasksCount(dueTodayCount)
        }
      } catch {
        // Safe fallback
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 15000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [pathname])

  const navItems = [
    {
      href: '/',
      label: 'Today Tasks',
      icon: LayoutDashboard,
      badge: openTasksCount > 0 ? openTasksCount : null,
    },
    {
      href: '/leads',
      label: 'All Leads',
      icon: Users,
    },
    {
      href: '/reports',
      label: 'Analytics',
      icon: BarChart3,
    },
    {
      href: '/services',
      label: 'Services',
      icon: Layers,
    },
    {
      href: '/templates',
      label: 'Templates',
      icon: FileText,
    },
    {
      href: '/settings',
      label: 'Cadence Rules',
      icon: Sliders,
    },
  ]

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <Link href="/" className="sidebar-logo" title="Selfera. - Sales Pipeline">
        <div className="sidebar-logo-icon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Selfera Logo" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#0f172a',
              lineHeight: 1.1,
            }}
          >
            Selfera<span style={{ color: '#0071e3' }}>.</span>
          </div>
          <div
            style={{
              fontSize: '0.725rem',
              fontWeight: 600,
              color: '#64748b',
              letterSpacing: '0.01em',
              marginTop: '2px',
              whiteSpace: 'nowrap',
            }}
          >
            Sales Pipeline
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : item.href === '/leads'
              ? pathname.startsWith('/leads') || pathname.startsWith('/company')
              : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--primary)' : 'var(--muted)' }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== null && item.badge !== undefined && (
                <span
                  style={{
                    backgroundColor: isActive ? 'var(--primary)' : 'var(--muted-bg)',
                    color: isActive ? '#ffffff' : 'var(--foreground)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Staff User Footer */}
      <div className="sidebar-footer">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem',
            backgroundColor: 'var(--muted-bg)',
            borderRadius: '10px',
            border: '1px solid var(--card-border)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: 'white',
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.825rem',
                fontWeight: 600,
                color: 'var(--foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={currentUser?.full_name || currentUser?.email || 'User'}
            >
              {currentUser?.full_name || 'User'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
              {currentUser?.role_name || 'Staff'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            title="Sign Out"
            style={{
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.4rem',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--danger)'
              e.currentTarget.style.backgroundColor = 'var(--danger-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <LogOut size={16} />
          </button>
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
    </aside>
  )
}
