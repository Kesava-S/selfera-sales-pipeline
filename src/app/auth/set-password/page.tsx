'use client'

// Invite links land here. Supabase puts a short-lived session in the URL
// (after #). We use it to let the person choose their password.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const access_token = hash.get('access_token')
    const refresh_token = hash.get('refresh_token')
    const linkError = hash.get('error_description')

    if (linkError) { setError('This link has expired or was already used. Ask an admin to send a new invite.'); return }
    if (!access_token || !refresh_token) {
      // Maybe already signed in from the link
      supabase.auth.getUser().then(({ data }) => (data.user ? setReady(true) : setError('This link is not valid. Ask an admin to send a new invite.')))
      return
    }
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      window.history.replaceState(null, '', window.location.pathname)
      if (error) setError('This link has expired or was already used. Ask an admin to send a new invite.')
      else setReady(true)
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold tracking-tight">Selfera<span className="text-primary">.</span></div>
          <p className="mt-1 text-sm text-slate-500">Choose your password</p>
        </div>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {ready && (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <input className="input" type="password" placeholder="New password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
            <input className="input" type="password" placeholder="Type it again" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
          </form>
        )}
        {!ready && !error && <p className="text-center text-sm text-muted">Checking your link…</p>}
      </div>
    </div>
  )
}
