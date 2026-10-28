import { RepliesPage } from '@/app/dashboard/campaigns/replies/loadReplies'

export const dynamic = 'force-dynamic'

export default function WhatsAppRepliesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <RepliesPage channel="whatsapp" searchParams={searchParams} />
}
