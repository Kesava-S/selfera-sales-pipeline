import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ChatInterface } from '@/components/v2/ChatInterface'
import { BreadcrumbSetter } from '@/components/BreadcrumbSetter'

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
          phone_number,
          email_address,
          instagram_handle
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

  // Fetch templates
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .order('name')

  // Fetch all threads for the opportunity for platform switcher
  const { data: allThreads } = await supabase
    .from('threads')
    .select('id, platform')
    .eq('opportunity_id', thread.opportunity_id)

  const service = thread.opportunities?.services_pitched?.[0] || 'Service'
  const type = thread.opportunities?.businesses?.business_type || 'Type'
  
  return (
    <>
      <BreadcrumbSetter breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: service, href: `/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}` },
        { label: type, href: `/dashboard/service/${encodeURIComponent(service)}/${encodeURIComponent(type)}` },
        { label: thread.opportunities?.businesses?.business_name || 'Business', href: `/dashboard/${oppId}` },
        { label: thread.platform }
      ]} />
      <ChatInterface 
        thread={thread as any} 
        activeDraft={activeDraft} 
        templates={templates || []} 
        allThreads={allThreads || []}
      />
    </>
  )
}
