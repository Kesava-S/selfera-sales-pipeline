'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { loginAjax } from './actions'
import { Spinner } from '@/components/ui'
import { Preloader } from '@/components/Preloader'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(initialError || null)
  const [isRedirecting, setIsRedirecting] = useState(false)

  const [isPending, startTransition] = useTransition()

  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim()
    if (!trimmed) {
      return 'Email address is required.'
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return 'Please enter a valid email address (e.g. name@selfera.com).'
    }
    return null
  }

  const validatePassword = (val: string): string | null => {
    if (!val) {
      return 'Password is required.'
    }
    if (val.length < 6) {
      return 'Password must be at least 6 characters.'
    }
    return null
  }

  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (emailError) {
      setEmailError(validateEmail(val))
    }
  }

  const handlePasswordChange = (val: string) => {
    setPassword(val)
    if (passwordError) {
      setPasswordError(validatePassword(val))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const eErr = validateEmail(email)
    const pErr = validatePassword(password)

    setEmailError(eErr)
    setPasswordError(pErr)
    setServerError(null)

    if (eErr || pErr) {
      return
    }

    startTransition(async () => {
      try {
        const result = await loginAjax(email, password, next)
        if (!result.success) {
          setServerError(result.error || 'Invalid credentials or access denied.')
        } else {
          setIsRedirecting(true)
          const target = next.startsWith('/') ? next : '/dashboard'
          window.location.href = target
        }
      } catch (err: any) {
        setServerError(err?.message || 'Something went wrong. Please try again.')
      }
    })
  }

  const showPreloader = isPending || isRedirecting

  return (
    <>
      {showPreloader && <Preloader fullScreen />}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {serverError && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-xs text-red-700 animate-fadeIn">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
            <div className="leading-snug font-medium">{serverError}</div>
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-700 uppercase"
          >
            Email Address
          </label>
          <div
            className={`relative flex items-center rounded-2xl border bg-white transition-all ${
              emailError
                ? 'border-red-400 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10'
                : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10'
            }`}
          >
            <div className={`pointer-events-none pl-4 ${emailError ? 'text-red-400' : 'text-slate-400'}`}>
              <Mail size={18} />
            </div>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="email"
              value={email}
              onChange={e => handleEmailChange(e.target.value)}
              onBlur={() => setEmailError(validateEmail(email))}
              placeholder="name@selfera.com"
              disabled={isPending}
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            />
          </div>
          {emailError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 animate-fadeIn">
              <AlertCircle size={13} className="shrink-0 text-red-500" />
              <span>{emailError}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-700 uppercase"
          >
            Password
          </label>
          <div
            className={`relative flex items-center rounded-2xl border bg-white transition-all ${
              passwordError
                ? 'border-red-400 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10'
                : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10'
            }`}
          >
            <div className={`pointer-events-none pl-4 ${passwordError ? 'text-red-400' : 'text-slate-400'}`}>
              <Lock size={18} />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => handlePasswordChange(e.target.value)}
              onBlur={() => setPasswordError(validatePassword(password))}
              placeholder="••••••••••••"
              disabled={isPending}
              className="w-full bg-transparent px-3 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="pr-4 text-slate-400 transition-colors hover:text-slate-600"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {passwordError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600 animate-fadeIn">
              <AlertCircle size={13} className="shrink-0 text-red-500" />
              <span>{passwordError}</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={showPreloader}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#067A52] py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-[#056845] active:scale-[0.99] disabled:opacity-70"
        >
          {showPreloader ? (
            <>
              <Spinner />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <LogIn size={18} />
              <span>Sign In</span>
            </>
          )}
        </button>

        <div className="pt-2">
          <div className="mb-4 border-t border-slate-100" />
          <p className="px-2 text-center text-xs italic font-medium leading-relaxed text-slate-400">
            &ldquo;Reach leads faster, collaborate seamlessly, convert with confidence.&rdquo;
          </p>
        </div>
      </form>
    </>
  )
}
