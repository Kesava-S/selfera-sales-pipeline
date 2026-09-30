import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/env'

/**
 * Universal Logging Utility for Selfera Sales Pipeline.
 * Manages app_logs, user_logs, and error_logs directly into the "sales-pipe" Supabase schema.
 * All logging functions fail-safe without throwing errors to prevent disrupting user experience.
 */

export interface LogDetails {
  [key: string]: unknown
}

/**
 * Log application lifecycle and background events.
 */
export async function logApp(
  event: string,
  category: 'system' | 'pipeline' | 'cadence' | 'outreach' | 'database' = 'system',
  details: LogDetails = {}
): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const supabase = createClient()
    await supabase.from('app_logs').insert({
      event,
      category,
      details,
    })
  } catch (err) {
    console.warn('[logApp] Failed to write app log to database:', err)
  }
}

/**
 * Log user actions, clicks, stage updates, and workflow interactions.
 */
export async function logUser(
  action: string,
  entityType?: 'lead' | 'task' | 'template' | 'navigation' | 'channel',
  entityId?: string,
  details: LogDetails = {},
  userId?: string,
  userName?: string
): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    let resolvedUserId = userId
    let resolvedUserName = userName

    if ((!resolvedUserId || !resolvedUserName) && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('selfera_user_profile')
        if (raw) {
          const profile = JSON.parse(raw)
          if (!resolvedUserId) resolvedUserId = profile.id || profile.user_id
          if (!resolvedUserName) resolvedUserName = profile.full_name || profile.email
        }
      } catch {
        // ignore
      }
    }

    const supabase = createClient()
    await supabase.from('user_logs').insert({
      user_id: resolvedUserId || null,
      user_name: resolvedUserName || 'User',
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details,
    })
  } catch (err) {
    console.warn('[logUser] Failed to write user log to database:', err)
  }
}

/**
 * Log client-side and server-side runtime errors and API exceptions.
 */
export async function logError(
  message: string,
  error?: unknown,
  context?: string,
  metadata: LogDetails = {},
  userId: string = 'sales-1'
): Promise<void> {
  console.error(`[Error Log - ${context || 'General'}]:`, message, error)
  if (!isSupabaseConfigured()) return
  try {
    const supabase = createClient()
    const errorStack = error instanceof Error ? error.stack : undefined
    await supabase.from('error_logs').insert({
      error_message: message,
      error_stack: errorStack || null,
      context: context || null,
      user_id: userId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.warn('[logError] Failed to write error log to database:', err)
  }
}
