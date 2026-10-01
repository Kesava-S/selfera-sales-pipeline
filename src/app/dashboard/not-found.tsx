import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <h1 className="mb-2 text-xl font-bold">Not found</h1>
      <p className="mb-6 text-sm text-slate-500">This page doesn&apos;t exist, or it belongs to a business that isn&apos;t assigned to you.</p>
      <Link href="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
    </div>
  )
}
