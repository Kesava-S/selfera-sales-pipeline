import { redirect } from 'next/navigation'

// Old link, still in emails already sent: the page now lives at /opt-out
export default async function OldUnsubscribeLink({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const q = new URLSearchParams(Object.entries(sp).filter((x): x is [string, string] => !!x[1]))
  redirect(q.toString() ? `/opt-out?${q}` : '/opt-out')
}
