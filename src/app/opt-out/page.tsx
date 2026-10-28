import { verifyUnsubscribe } from '@/lib/unsubscribe'
import { audienceOptOutStatus, isEmailOptedOut } from '@/lib/recordUnsubscribe'
import { confirmOptOut } from './actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Opt out',
  robots: { index: false, follow: false },
}

// Opened from the "Opt out" link in our emails. It asks for one click rather
// than opting out on open: mail security scanners open every link in an email,
// which would otherwise opt out leads who never clicked.
// Client Audience emails add c (the customer): they opt out of that client only,
// and the page shows the client's name instead of Selfera's.
export default async function OptOutPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string; c?: string; failed?: string }>
}) {
  const { e, s, c, failed } = await searchParams
  const verified = verifyUnsubscribe(e, s, c)
  const audience = verified && c ? await audienceOptOutStatus(c, verified) : null
  const email = c && !audience ? null : verified
  const done = audience ? audience.optedOut : email ? await isEmailOptedOut(email) : false
  const sender = audience?.client ?? 'Selfera'
  const contact = audience ? 'reply to their email' : <>write to <a className="font-semibold text-[#00795f] underline" href="mailto:support@selfera.co.uk?subject=Opt-Out">support@selfera.co.uk</a></>

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8] p-4 sm:p-6">
      <div className="w-full max-w-[440px] rounded-[28px] border border-slate-200/70 bg-white p-8 text-center shadow-2xl shadow-slate-300/40 sm:p-10">
        {audience ? (
          <p className="text-xl font-extrabold tracking-tight text-slate-900">{audience.client}</p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="mx-auto h-12 w-12 object-contain" />
            <p className="mt-2 text-xl font-extrabold tracking-tight text-[#002921]">
              Selfera<span className="text-[#00a383]">.</span>
            </p>
          </>
        )}

        {!email ? (
          <>
            <h1 className="mt-6 text-xl font-bold text-slate-900">This link doesn&apos;t work</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              It may be incomplete. Reply to the email with &quot;Opt out&quot;, or{' '}
              <a className="font-semibold text-[#00795f] underline" href="mailto:support@selfera.co.uk?subject=Opt-Out">write to support@selfera.co.uk</a>,
              and we&apos;ll remove you.
            </p>
          </>
        ) : done ? (
          <>
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 motion-check-pop">✓</div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">You&apos;ve opted out</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {audience ? `${sender} won't` : 'We won\'t'} email <span className="font-semibold text-slate-700">{email}</span> again.
              Sorry for the trouble.
            </p>
            <p className="mt-6 text-xs text-slate-400">Changed your mind? Just {contact}.</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-bold text-slate-900">Opt out of {sender} emails?</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {audience ? `${sender} will stop emailing` : 'We\'ll stop emailing'} <span className="font-semibold text-slate-700">{email}</span>.
            </p>
            <form action={confirmOptOut} className="mt-6">
              <input type="hidden" name="e" value={e} />
              <input type="hidden" name="s" value={s} />
              {audience && <input type="hidden" name="c" value={c} />}
              <button type="submit" className="w-full rounded-xl bg-[#002921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00402f] active:scale-[0.98]">
                Opt out
              </button>
            </form>
            {failed && <p className="mt-3 text-sm text-red-600">Something went wrong. Please try again.</p>}
          </>
        )}
      </div>
    </div>
  )
}
