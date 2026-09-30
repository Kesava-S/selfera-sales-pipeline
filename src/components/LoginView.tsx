'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { attemptAutoSSO, loginViaAdminBackend } from '@/lib/authUtils'

export function LoginView() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  // Handle URL errors on load (e.g. from redirect) & attempt Auto-SSO
  useEffect(() => {
    let isMounted = true

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      const loggedOut =
        params.get('logged_out') === 'true' ||
        sessionStorage.getItem('selfera_explicit_logout') === 'true'

      if (loggedOut) {
        showToast('Logged out successfully', 'success')
        return
      }

      if (error === 'access_denied') {
        showToast('Access Denied: Your account role does not have permission to access the Sales Pipeline.', 'error')
        setErrors({ email: 'Access denied: Role not authorized for Sales Pipeline' })
        return
      } else if (error === 'token_expired') {
        showToast('SSO session expired. Please launch again from the Selfera Admin portal.', 'error')
        return
      } else if (error === 'invalid_token' || error === 'missing_token' || error === 'sso_failed') {
        showToast('SSO authentication failed. Please sign in with your credentials.', 'error')
        return
      } else if (error === 'auth_failed') {
        showToast('Authentication failed. Please check your credentials or try again.', 'error')
        return
      }

      // If no explicit error and not explicitly logged out, try automatic SSO
      const checkSSO = async () => {
        try {
          const autoRes = await attemptAutoSSO()
          if (autoRes.success && isMounted) {
            showToast('Authentication successful', 'success')
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('selfera_auth_toast', 'Authentication successful')
            }
            window.location.replace('/?sso=success')
          }
        } catch {
          // Non-blocking
        }
      }
      checkSSO()
    }

    return () => {
      isMounted = false
    }
  }, [])

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle Email & Password Login with Database Auth & Role verification
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (authError) {
        // Fall back to Selfera Admin Staff authentication backend (port 3001)
        const adminRes = await loginViaAdminBackend(email, password)
        if (adminRes.success) {
          showToast('Authentication successful', 'success')
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('selfera_auth_toast', 'Authentication successful')
          }
          setTimeout(() => {
            window.location.replace('/?sso=success')
          }, 400)
          return
        }

        setErrors({ email: adminRes.error || authError.message })
        showToast(adminRes.error || authError.message, 'error')
        setIsLoading(false)
        return
      }

      if (authData?.user) {
        const userEmail = (authData.user.email || '').trim().toLowerCase()
        const authUserId = authData.user.id

        // 1. Fetch user profile from public schema
        const { data: userProfiles } = await supabase
          .schema('public')
          .from('users')
          .select('id, user_id, email, full_name, role_id, is_active')
          .or(`user_id.eq.${authUserId},email.ilike.${userEmail}`)

        const userProfile = userProfiles && userProfiles.length > 0 ? userProfiles[0] : null

        if (userProfile?.role_id) {
          // 2. Verify access to Sales Pipeline (product_id: 11)
          const { data: accessData } = await supabase
            .schema('public')
            .from('role_product_access')
            .select('can_access')
            .eq('role_id', userProfile.role_id)
            .eq('product_id', 11)
            .maybeSingle()

          if (accessData && accessData.can_access === false) {
            await supabase.auth.signOut()
            showToast('Access Denied: Your account role does not have permission to access the Sales Pipeline.', 'error')
            setErrors({ email: 'Access denied: Your role is restricted from accessing Sales Pipeline' })
            setIsLoading(false)
            return
          }
        }

        // 3. Cache verified user profile for instant UI reactivity
        const roleId = userProfile?.role_id ?? 2
        const roleNames: Record<number, string> = {
          1: 'Founder',
          2: 'UK Staff',
          3: 'Team Lead',
          4: 'Full Time',
          5: 'Intern',
        }
        const roleName = roleNames[roleId] || 'Staff'
        const rawName = userProfile?.full_name || authData.user.user_metadata?.full_name || userEmail.split('@')[0] || 'User'
        const fullName = rawName.charAt(0).toUpperCase() + rawName.slice(1)

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'selfera_user_profile',
            JSON.stringify({
              id: userProfile?.id || authUserId,
              user_id: authUserId,
              email: authData.user.email || userEmail,
              full_name: fullName,
              role_id: roleId,
              role_name: roleName,
              initial: fullName.charAt(0).toUpperCase() || 'U',
              is_active: userProfile?.is_active ?? true,
            })
          )
          window.dispatchEvent(new Event('selfera_user_profile_updated'))
        }

        // 4. Log successful login audit in sales-pipe.user_logs
        try {
          await supabase.from('user_logs').insert({
            user_id: userProfile?.id || authUserId,
            user_name: fullName,
            action: 'USER_LOGIN',
            entity_type: 'auth',
            details: { provider: 'email', timestamp: new Date().toISOString() },
          })
        } catch {
          // non-blocking audit
        }

        showToast(`Welcome back, ${fullName}! Redirecting...`, 'success')
        setTimeout(() => {
          router.push('/')
        }, 600)
      }
    } catch {
      showToast('An unexpected error occurred during sign in. Please try again.', 'error')
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      {/* Decorative ambient gradients */}
      <div className="auth-bg-ambient-1" />
      <div className="auth-bg-ambient-2" />

      {/* Floating Top-Right Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.25rem',
            right: '1.75rem',
            backgroundColor: toast.type === 'error' ? '#7f1d1d' : '#0f172a',
            color: '#ffffff',
            padding: '0.85rem 1.35rem',
            borderRadius: '12px',
            border: `1px solid ${toast.type === 'error' ? '#991b1b' : '#1e293b'}`,
            boxShadow: 'var(--shadow-xl)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={18} style={{ color: '#f87171' }} />
          ) : (
            <CheckCircle size={18} style={{ color: '#10b981' }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="login-page-container">
        {/* Clean White Floating Login Card */}
        <div className="login-card">
          {/* Top Brand Info */}
          <div className="login-brand-header">
            <Image
              src="/logo.png"
              alt="Selfera Logo"
              width={54}
              height={72}
              className="login-logo-img"
              priority
            />
            <div className="login-brand-name">
              Selfera<span className="login-brand-dot">.</span>
            </div>
            <div className="login-brand-sub">
              SALES PIPELINE SYSTEM
            </div>
          </div>

          {/* Heading */}
          <h2 className="login-welcome-title">Welcome Back</h2>
          <p className="login-welcome-sub">Sign in to your Selfera workspace</p>

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {/* Email Address */}
            <div className="login-field-group">
              <label htmlFor="login-email" className="login-label">
                EMAIL ADDRESS
              </label>
              <div className={`login-input-box ${errors.email ? 'has-error' : ''}`}>
                <Mail size={17} style={{ color: errors.email ? '#ef4444' : '#94a3b8', flexShrink: 0 }} />
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@selfera.co.uk"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: undefined }))
                    }
                  }}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {errors.email && (
                <div className="login-field-error">
                  <AlertCircle size={14} />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>

            {/* Password */}
            <div className="login-field-group">
              <label htmlFor="login-password" className="login-label">
                PASSWORD
              </label>
              <div className={`login-input-box ${errors.password ? 'has-error' : ''}`}>
                <Lock size={17} style={{ color: errors.password ? '#ef4444' : '#94a3b8', flexShrink: 0 }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) {
                      setErrors((prev) => ({ ...prev, password: undefined }))
                    }
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <div className="login-field-error">
                  <AlertCircle size={14} />
                  <span>{errors.password}</span>
                </div>
              )}
            </div>

            {/* Sign In CTA Button */}
            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Thin Divider Line */}
          <div className="login-card-divider" />

          {/* Footer Quote */}
          <div className="login-quote">
            &ldquo;Streamline outreach, automate cadences, close with confidence.&rdquo;
          </div>
        </div>
      </div>
    </div>
  )
}
