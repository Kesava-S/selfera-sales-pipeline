import { ServiceType, ALL_SERVICES } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { logUser } from '@/lib/logger'

export { ALL_SERVICES }
export type { ServiceType }

export interface ServiceMeta {
  type: ServiceType
  label: string
  color: string // Text color only - zero background highlights
  description: string
  iconName: 'Globe' | 'LayoutDashboard' | 'Cpu' | 'Workflow' | 'Send'
}

export const SERVICES_CONFIG: Record<ServiceType, ServiceMeta> = {
  'Website Services': {
    type: 'Website Services',
    label: 'Website Services',
    color: 'var(--color-primary-light, #60a5fa)',
    description: 'Modern UI/UX design, corporate sites & high-converting landing pages',
    iconName: 'Globe',
  },
  'Dashboard Services': {
    type: 'Dashboard Services',
    label: 'Dashboard Services',
    color: '#34d399', // Emerald
    description: 'Custom internal dashboards, analytics portals & BI metrics',
    iconName: 'LayoutDashboard',
  },
  'Micro Services': {
    type: 'Micro Services',
    label: 'Micro Services',
    color: '#a78bfa', // Purple
    description: 'Dedicated APIs, micro-utilities & modular cloud functions',
    iconName: 'Cpu',
  },
  'End to End Automation': {
    type: 'End to End Automation',
    label: 'End to End Automation',
    color: '#f59e0b', // Amber
    description: 'n8n workflows, CRM integrations & sales ops auto-sync',
    iconName: 'Workflow',
  },
  'Cold Outreach': {
    type: 'Cold Outreach',
    label: 'Cold Outreach',
    color: '#ec4899', // Pink
    description: 'Outbound multi-channel sequences across WhatsApp, IG & Email',
    iconName: 'Send',
  },
}

export function getServiceMeta(service?: string | null): ServiceMeta {
  if (service && service in SERVICES_CONFIG) {
    return SERVICES_CONFIG[service as ServiceType]
  }
  return SERVICES_CONFIG['Website Services']
}

export interface RecordServicePivotParams {
  leadId: string
  businessName: string
  fromService: string
  toService: string
  currentStage: string
  reason: string
  changedBy?: string
  additionalNotes?: string
}

/**
 * Executes a service transition:
 * 1. Updates current_service in `leads`
 * 2. Writes to `lead_service_history`
 * 3. Writes human-readable audit record to `activity_log`
 * 4. Logs to `user_logs`
 */
export async function recordServicePivot(params: RecordServicePivotParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { leadId, businessName, fromService, toService, currentStage, reason, changedBy = 'Sales Team', additionalNotes } = params

    // 1. Update lead current_service (and agreed_service if stage is Won)
    const updatePayload: Record<string, unknown> = {
      current_service: toService,
    }

    if (currentStage === 'Won') {
      updatePayload.agreed_service = toService
    }

    if (additionalNotes) {
      updatePayload.service_notes = additionalNotes
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId)

    if (updateError) {
      console.error('[recordServicePivot] Failed to update lead:', updateError)
      return { success: false, error: updateError.message }
    }

    // 2. Insert into lead_service_history (fail-safe if migration is pending)
    try {
      await supabase.from('lead_service_history').insert({
        lead_id: leadId,
        business_name: businessName,
        from_service: fromService,
        to_service: toService,
        transition_stage: currentStage,
        reason,
        changed_by: changedBy,
      })
    } catch (historyErr) {
      console.warn('[recordServicePivot] lead_service_history insert skipped:', historyErr)
    }

    // 3. Insert into activity_log
    const activityDetail = `[Service Pivot] Changed from "${fromService}" to "${toService}". Reason: ${reason}${additionalNotes ? ` | Note: ${additionalNotes}` : ''}`
    await supabase.from('activity_log').insert({
      lead_id: leadId,
      action_type: 'note',
      details: activityDetail,
      created_by: changedBy,
    })

    // 4. Log user action
    await logUser(
      `Pivoted service for ${businessName} from ${fromService} to ${toService}`,
      'lead',
      leadId,
      {
        from_service: fromService,
        to_service: toService,
        reason,
        stage: currentStage,
      }
    )

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during service pivot'
    console.error('[recordServicePivot] Exception:', err)
    return { success: false, error: message }
  }
}
