import { login } from './actions'
import { AlertCircle } from 'lucide-react'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold tracking-tight">
            Selfera<span className="text-primary">.</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Sign in to the Sales Pipeline</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form className="flex flex-col gap-4" action={login}>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <button className="btn btn-primary w-full">Log in</button>
          <p className="text-center text-xs text-slate-500">No account? Ask an admin to invite you.</p>
        </form>
      </div>
    </div>
  )
}
