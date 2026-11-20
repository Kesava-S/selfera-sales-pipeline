import { createServiceClient } from '@/lib/supabase/server'

export type AdminNotificationType = 'info' | 'warning' | 'alert' | 'action_required'

export interface SendAdminNotificationParams {
  title?: string
  message?: string
  type?: AdminNotificationType
  employeeId?: number | null
  link?: string
  metadata?: Record<string, unknown>
}

/**
 * Send a notification to the central Selfera Admin Panel via shared.product_notifications.
 *
 * Sets title to our product name ('Sales Pipeline') to conform with central admin panel
 * convention. Full notification details are preserved in message.
 *
 * Safe and non-blocking: errors are logged and will never fail or throw,
 * preserving the stability of the Sales Pipeline.
 */
export async function sendAdminNotification({
  title,
  message,
  type = 'info',
  employeeId = null,
  link,
  metadata = {},
}: SendAdminNotificationParams): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createServiceClient()

    // Title is always our product name ('Sales Pipeline') for shared.product_notifications.
    // If a specific title was passed, format it into the message to preserve full detail.
    let formattedMessage: string
    if (title && title !== 'Sales Pipeline') {
      formattedMessage = message && message !== title ? `${title} - ${message}` : title
    } else {
      formattedMessage = message || title || 'Sales Pipeline notification'
    }

    const { error } = await supabase
      .schema('shared')
      .from('product_notifications')
      .insert({
        product_code: 'sales_pipeline',
        title: 'Sales Pipeline',
        message: formattedMessage,
        type,
        employee_id: employeeId, // null notifies all admins
        // shared.product_notifications has no link column: the link goes in metadata (migration 74)
        metadata: {
          ...metadata,
          ...(link ? { link } : {}),
          channel: 'in_app',
          ...(title && title !== 'Sales Pipeline' ? { original_title: title } : {}),
        },
      })

    if (error) {
      console.error('[AdminNotification] Insert failed:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AdminNotification] Error:', msg)
    return { ok: false, error: msg }
  }
}
