'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  Sliders,
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const [openTasksCount, setOpenTasksCount] = useState<number>(0)

  useEffect(() => {
    let isMounted = true
    const fetchCount = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { count, error } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
        if (!error && count !== null && isMounted) {
          setOpenTasksCount(count)
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
      href: '/dashboard',
      label: 'Dashboard Home',
      icon: LayoutDashboard,
      badge: openTasksCount > 0 ? openTasksCount : null,
    },
    {
      href: '/dashboard/leads',
      label: 'All Leads & Imports',
      icon: Users,
    },
    {
      href: '/templates',
      label: 'Templates (V2)',
      icon: FileText,
    },
    {
      href: '/settings',
      label: 'Settings',
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
            }}
          >
            K
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Kesav
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
              Admin
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
