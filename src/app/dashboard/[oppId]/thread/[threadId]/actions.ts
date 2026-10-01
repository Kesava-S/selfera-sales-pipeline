'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendOutboundMessage(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const threadId = formData.get('threadId') as string
  const body = formData.get('body') as string
  const subject = formData.get('subject') as string | null
  const templateId = formData.get('templateId') as string | null

  // 1. Call n8n webhook (which in turn logs it to our DB)
  // For now, we will simulate the n8n webhook response by directly calling our DB function 
  // since this is a local environment without n8n hooked up.
  // In production, we'd do a fetch() to n8n here instead of hitting the DB directly.

  const { error } = await supabase.rpc('record_outbound', {
    p_thread_id: threadId,
    p_body: body,
    p_subject: subject || null,
    p_template_id: templateId || null,
    p_send_method: 'api',
    p_external_message_id: 'local-' + Date.now(),
    p_sent_by: user.id
  })

  if (error) {
    console.error('Error sending message:', error)
    throw new Error('Failed to send message')
  }

  revalidatePath('/dashboard/[oppId]/thread/[threadId]', 'page')
  return { success: true }
}
