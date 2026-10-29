import { createServiceClient } from '@/lib/supabase/server'

export type AdminNotificationType = 'info' | 'warning' | 'alert' | 'action_required'

export interface SendAdminNotificationParams {
  title: string
  message?: string
  type?: AdminNotificationType
  employeeId?: number | null
  link?: string
  metadata?: Record<string, unknown>
}

/**
 * Send a notification to the central Selfera Admin Panel via shared.product_notifications.
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
    const { error } = await supabase
      .schema('shared')
      .from('product_notifications')
      .insert({
        product_code: 'sales_pipeline',
        title,
        message: message ?? title,
        type,
        employee_id: employeeId, // null notifies all admins
        link: link ?? null,
        metadata,
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

