'use client'

// Invite links land here. Supabase puts a short-lived session in the URL
// (after # or via /auth/confirm or search params). We use it to let the person choose their password.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui'
import { Preloader } from '@/components/Preloader'
import { Eye, EyeOff, Check, Lock, ShieldCheck } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  consultant: 'Consultant',
  sales: 'Sales Representative',
  sales_consultant: 'Sales + Consultant',
}

export default function SetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invited user details
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('sales')

  // Password fields & visibility
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Real-time password requirement rules
  const rules = [
    { label: 'At least 8 characters at minimum', valid: password.length >= 8 },
    { label: 'At least one capital letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'At least one digit / number (0-9)', valid: /[0-9]/.test(password) },
    { label: 'At least one special character (!@#$%^&*)', valid: /[^A-Za-z0-9]/.test(password) },
  ]
  const allRulesPassed = rules.every(r => r.valid)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    async function syncUserInfo(user: any) {
      if (!user || !mounted) return
      const email = user.email || ''
      let name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || ''
      let role = (user.user_metadata?.role as string) || ''

      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .maybeSingle()
        if (prof) {
          if (prof.full_name) name = prof.full_name
          if (prof.role) role = prof.role
        }
      } catch (err) {
        console.warn('[SetPasswordPage] could not fetch profile info:', err)
      }

      if (mounted) {
        setUserEmail(email)
        setUserName(name || email.split('@')[0])
        setUserRole(role || 'sales')
        setReady(true)
      }
    }

    async function initAuth() {
      // 1. Check for errors in query params (e.g. redirected from /auth/confirm or Supabase)
      const search = new URLSearchParams(window.location.search)
      const queryError = search.get('error')
      const queryDesc = search.get('error_description')
      if (queryError || queryDesc) {
        if (mounted) {
          setError(queryDesc || 'This invitation link has expired or was already used. Ask an admin to send a new invite.')
        }
        return
      }

      // 2. Check for token_hash in search params (direct client verify fallback)
      const token_hash = search.get('token_hash')
      const otpType = (search.get('type') || 'invite') as 'invite' | 'recovery' | 'magiclink' | 'signup'
      if (token_hash) {
        try {
          const { data, error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash,
            type: otpType,
          })
          if (verifyErr) {
            if (mounted) setError('This invitation link has expired or was already used. Ask an admin to send a new invite.')
            return
          }
          if (data?.user) {
            window.history.replaceState(null, '', window.location.pathname)
            await syncUserInfo(data.user)
          }
          return
        } catch {
          if (mounted) setError('Could not verify invitation link. Please check your connection and try again.')
          return
        }
      }

      // 3. Check for PKCE auth code in search params
      const code = search.get('code')
      if (code) {
        try {
          const { data, error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (codeErr) {
            if (mounted) setError('This link has expired or was already used. Ask an admin to send a new invite.')
            return
          }
          if (data?.user) {
            window.history.replaceState(null, '', window.location.pathname)
            await syncUserInfo(data.user)
          }
          return
        } catch {
          if (mounted) setError('Could not verify link. Please try again.')
          return
        }
      }

      // 4. Check for hash parameters (#access_token=...&refresh_token=...)
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')
      const hashError = hash.get('error_description') || hash.get('error')

      if (hashError) {
        if (mounted) setError('This link has expired or was already used. Ask an admin to send a new invite.')
        return
      }

      if (access_token && refresh_token) {
        try {
          const { data, error: setErr } = await supabase.auth.setSession({ access_token, refresh_token })
          window.history.replaceState(null, '', window.location.pathname)
          if (setErr) {
            if (mounted) setError('This link has expired or was already used. Ask an admin to send a new invite.')
          } else if (data?.user) {
            await syncUserInfo(data.user)
          }
          return
        } catch {
          if (mounted) setError('Failed to restore session. Ask an admin to send a new invite.')
          return
        }
      }

      // 5. Check if user already has an active session (e.g. established via /auth/confirm)
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        await syncUserInfo(data.user)
      } else {
        if (mounted) {
          setError('This link is not valid or has expired. Ask an admin to send a new invite.')
        }
      }
    }

    initAuth()

    return () => {
      mounted = false
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const errs: { password?: string; confirm?: string } = {}

    if (!password) {
      errs.password = 'Please enter a password.'
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters at minimum.'
    } else if (!/[A-Z]/.test(password)) {
      errs.password = 'Password must include at least one capital letter (A-Z).'
    } else if (!/[0-9]/.test(password)) {
      errs.password = 'Password must include at least one digit (0-9).'
    } else if (!/[^A-Za-z0-9]/.test(password)) {
      errs.password = 'Password must include at least one special character (!@#$%^&*).'
    }

    if (!confirm) {
      errs.confirm = 'Please confirm your password.'
    } else if (password !== confirm) {
      errs.confirm = 'Passwords do not match.'
    }

    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setBusy(true)
    try {
      // 1. Update password & set password_set metadata in Supabase Auth
      const { error: authErr } = await createClient().auth.updateUser({
        password,
        data: { password_set: true, password_set_at: new Date().toISOString() },
      })
      if (authErr) {
        setBusy(false)
        return setError(authErr.message)
      }

      // 2. Activate user in profiles table so status transitions from pending to active
      const { completePasswordSetup } = await import('@/app/dashboard/actions')
      const actRes = await completePasswordSetup()
      if (!actRes.ok) {
        setBusy(false)
        return setError(actRes.error || 'Failed to activate account. Please try again.')
      }

      setIsRedirecting(true)
      router.replace('/dashboard')
      router.refresh()
    } catch {
      setBusy(false)
      setIsRedirecting(false)
      return setError('Could not reach the server. Check your connection and try again.')
    }
  }

  const roleLabel = ROLE_LABELS[userRole] || userRole || 'Sales Representative'

  if (!ready && !error) {
    return <Preloader fullScreen />
  }

  return (
    <>
      {(busy || isRedirecting) && <Preloader fullScreen />}
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="card w-full max-w-md p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">
              Selfera<span className="text-primary">.</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Activate your account &amp; set password</p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 leading-relaxed">
              {error}
            </div>
          )}

          {ready && (
          <>
            {/* User Invitation Details */}
            <div className="mb-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-base">
                  {(userName || userEmail || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">
                    {userName || 'Team Member'}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {userEmail || '—'}
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
              {/* New Password */}
              <div>
                <label className="label">
                  New Password <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    className={`input pr-10 ${fieldErrors.password ? '!border-rose-400' : ''}`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }))
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.password}</p>}

                {/* Password Requirements Checklist */}
                <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <ShieldCheck size={13} className="text-slate-400" />
                    <span>Password Rules</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 text-xs">
                    {rules.map((rule, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 transition-colors ${
                          rule.valid ? 'text-emerald-700 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {rule.valid ? (
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          </div>
                        )}
                        <span>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="label">
                  Confirm Password <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    className={`input pr-10 ${fieldErrors.confirm ? '!border-rose-400' : ''}`}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => {
                      setConfirm(e.target.value)
                      if (fieldErrors.confirm) setFieldErrors(prev => ({ ...prev, confirm: undefined }))
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3 p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.confirm && <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.confirm}</p>}
                {password && confirm && password === confirm && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <Check size={12} strokeWidth={2.5} /> Passwords match
                  </p>
                )}
              </div>

              <button
                className="btn btn-primary mt-2 h-11 text-sm font-semibold shadow-xs"
                disabled={busy || !allRulesPassed}
              >
                {busy && <Spinner />} {busy ? 'Saving…' : 'Set Password & Enter Dashboard'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
    </>
  )
}
