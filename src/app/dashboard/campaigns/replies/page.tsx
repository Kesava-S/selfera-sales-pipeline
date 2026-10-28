import { RepliesPage } from './loadReplies'

export const dynamic = 'force-dynamic'

export default function EmailRepliesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <RepliesPage channel="email" searchParams={searchParams} />
}
