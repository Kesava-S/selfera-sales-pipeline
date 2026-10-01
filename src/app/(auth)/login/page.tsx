import { login, signup } from './actions'
import { AlertCircle } from 'lucide-react'
import Image from 'next/image'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] p-4">
      <div className="card w-full max-w-md p-8 shadow-xl">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Selfera Logo" width={150} height={40} />
        </div>
        
        <h1 className="text-2xl font-semibold text-center mb-2">Welcome Back</h1>
        <p className="text-muted text-center mb-8">Sign in to your Selfera Sales Dashboard</p>

        {error && (
          <div className="mb-6 p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form className="flex flex-col gap-4" action={login}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input w-full"
              placeholder="you@selfera.com"
            />
          </div>
          
          <div className="form-group mb-2">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input w-full"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-2">
            <button formAction={login} className="btn btn-primary flex-1 justify-center">
              Log in
            </button>
            <button formAction={signup} className="btn btn-secondary flex-1 justify-center">
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
