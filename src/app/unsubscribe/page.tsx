import { verifyUnsubscribe } from '@/lib/unsubscribe'
import { isEmailOptedOut } from '@/lib/recordUnsubscribe'
import { confirmUnsubscribe } from './actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Unsubscribe | Selfera',
  robots: { index: false, follow: false },
}

// Opened from the "Unsubscribe" link in our emails. It asks for one click rather
// than unsubscribing on open: mail security scanners open every link in an email,
// which would otherwise unsubscribe leads who never clicked.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string; failed?: string }>
}) {
  const { e, s, failed } = await searchParams
  const email = verifyUnsubscribe(e, s)
  const done = email ? await isEmailOptedOut(email) : false

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4 sm:p-6">
      <div className="w-full max-w-[440px] rounded-[28px] border border-slate-200/70 bg-white p-8 text-center shadow-2xl shadow-slate-300/40 sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="mx-auto h-12 w-12 object-contain" />
        <p className="mt-2 text-xl font-extrabold tracking-tight text-[#002921]">
          Selfera<span className="text-[#00a383]">.</span>
        </p>

        {!email ? (
          <>
            <h1 className="mt-6 text-xl font-bold text-slate-900">This link doesn&apos;t work</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              It may be incomplete. Reply to our email with &quot;Unsubscribe&quot;, or write to{' '}
              <a className="font-semibold text-[#00795f] underline" href="mailto:support@selfera.co.uk?subject=Unsubscribe">support@selfera.co.uk</a>,
              and we&apos;ll remove you.
            </p>
          </>
        ) : done ? (
          <>
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 motion-check-pop">✓</div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">You&apos;ve been unsubscribed</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              We won&apos;t email <span className="font-semibold text-slate-700">{email}</span> again.
              Sorry for the trouble.
            </p>
            <p className="mt-6 text-xs text-slate-400">
              Changed your mind? Write to{' '}
              <a className="underline" href="mailto:support@selfera.co.uk">support@selfera.co.uk</a>.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-bold text-slate-900">Unsubscribe from Selfera emails?</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              We&apos;ll stop emailing <span className="font-semibold text-slate-700">{email}</span>.
            </p>
            <form action={confirmUnsubscribe} className="mt-6">
              <input type="hidden" name="e" value={e} />
              <input type="hidden" name="s" value={s} />
              <button type="submit" className="w-full rounded-xl bg-[#002921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00402f] active:scale-[0.98]">
                Unsubscribe
              </button>
            </form>
            {failed && <p className="mt-3 text-sm text-red-600">Something went wrong. Please try again.</p>}
          </>
        )}
      </div>
    </div>
  )
}
