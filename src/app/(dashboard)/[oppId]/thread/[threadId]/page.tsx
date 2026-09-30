import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ChatInterface } from '@/components/v2/ChatInterface'

export const dynamic = 'force-dynamic'

export default async function Page({
  params
}: {
  params: Promise<{ oppId: string, threadId: string }>
}) {
  const { oppId, threadId } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch thread + messages + drafts + opportunity + business
  const { data: thread, error } = await supabase
    .from('threads')
    .select(`
      *,
      messages (*),
      drafts (*),
      opportunities (
        id,
        stage,
        services_pitched,
        businesses (
          id,
          business_name,
          business_type,
          contact_name,
          phone,
          email,
          instagram
        )
      )
    `)
    .eq('id', threadId)
    .single()

  if (error || !thread) return notFound()

  // Sort messages ascending
  if (thread.messages) {
    thread.messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  // Get active draft (one that isn't sent)
  const activeDraft = thread.drafts?.find((d: any) => d.status !== 'sent')

  return <ChatInterface thread={thread} activeDraft={activeDraft} />
}
