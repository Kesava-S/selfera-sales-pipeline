import { signOut } from '@/app/dashboard/actions'

export function AccountNotSetup() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-xl font-bold">Your account isn&apos;t set up yet</h1>
        <p className="mb-6 text-sm text-slate-500">You&apos;re logged in, but you don&apos;t have a profile yet, or it has been switched off. Ask an admin to add you.</p>
        <form action={signOut}>
          <button className="btn btn-secondary">Log out</button>
        </form>
      </div>
    </div>
  )
}
