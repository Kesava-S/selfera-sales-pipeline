import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Sign In | Selfera Sales Pipeline',
  description: 'Sign in to your Selfera workspace',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4 sm:p-6">
      <div className="w-full max-w-[420px] rounded-[36px] border border-slate-200/70 bg-white p-8 shadow-2xl shadow-slate-300/40 sm:p-10">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Selfera Logo" className="h-14 w-14 object-contain" />
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Selfera<span className="text-[#0284c7]">.</span>
          </h2>

          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Sales Pipeline
          </p>

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            Welcome Back
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Sign in to your Selfera workspace
          </p>
        </div>

        <div className="mt-6">
          <Suspense fallback={<div className="py-8 text-center text-sm text-slate-400">Loading workspace...</div>}>
            <LoginForm initialError={error} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
