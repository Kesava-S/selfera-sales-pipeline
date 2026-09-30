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
  // Check if it's a known combo or custom service
  return (
    SERVICES_CONFIG['Website Services']
  )
}

/**
 * Splits a composite service string into individual service offerings
 * e.g. "Dashboard Services + End to End Automation" -> ["Dashboard Services", "End to End Automation"]
 */
export function parseComboServices(serviceStr?: string | null): string[] {
  if (!serviceStr) return ['Website Services']
  if (serviceStr.includes(' + ')) {
    return serviceStr.split(' + ').map((s) => s.trim()).filter(Boolean)
  }
  if (serviceStr.includes(', ')) {
    return serviceStr.split(', ').map((s) => s.trim()).filter(Boolean)
  }
  return [serviceStr.trim()]
}

/**
 * Formats multiple service offerings into a standard combo string
 */
export function formatComboServices(services: string[]): string {
  const clean = services.map((s) => s.trim()).filter(Boolean)
  if (clean.length === 0) return 'Website Services'
  return clean.join(' + ')
}

/**
 * Constructs the full transition chain from history records:
 * e.g. ["Website Services", "Dashboard Services", "End to End Automation"]
 */
export function buildPivotChain(
  initialService: string | undefined | null,
  history: Array<{ from_service: string; to_service: string }>,
  currentService?: string | null
): string[] {
  if (!history || history.length === 0) {
    if (initialService && currentService && initialService !== currentService) {
      return [initialService, currentService]
    }
    return currentService ? [currentService] : initialService ? [initialService] : []
  }

  const chain: string[] = []
  if (initialService) {
    chain.push(initialService)
  } else if (history[0]?.from_service) {
    chain.push(history[0].from_service)
  }

  for (const item of history) {
    if (item.from_service && !chain.includes(item.from_service)) {
      chain.push(item.from_service)
    }
    if (item.to_service && chain[chain.length - 1] !== item.to_service) {
      chain.push(item.to_service)
    }
  }

  if (currentService && chain[chain.length - 1] !== currentService) {
    chain.push(currentService)
  }

  return chain
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
      console.error('[recordServicePivot] Failed to update lead:', updateError.message, updateError.details, updateError.hint, updateError.code)
      return { success: false, error: updateError.message || 'Failed to update lead record.' }
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

/**
 * Result of checking which services are already pitched for a business
 */
export interface BusinessPitchedServicesResult {
  pitchedServices: string[]
  leadCodesByService: Record<string, string>
  availableServices: ServiceType[]
  allServicesPitched: boolean
}

/**
 * Fetches all services that have EVER been pitched to a given business name.
 * This includes:
 * - initial_service of any existing lead for that company (even if pivoted later)
 * - current_service of any existing lead for that company
 * - any service recorded in lead_service_history for that company
 */
export async function getPitchedServicesForBusiness(businessName: string): Promise<BusinessPitchedServicesResult> {
  const cleanName = businessName ? businessName.trim() : ''
  if (!cleanName) {
    return {
      pitchedServices: [],
      leadCodesByService: {},
      availableServices: [...ALL_SERVICES],
      allServicesPitched: false,
    }
  }

  try {
    const supabase = createClient()
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, lead_code, initial_service, current_service')
      .ilike('business_name', cleanName)

    if (error || !leads || leads.length === 0) {
      return {
        pitchedServices: [],
        leadCodesByService: {},
        availableServices: [...ALL_SERVICES],
        allServicesPitched: false,
      }
    }

    const leadCodesByService: Record<string, string> = {}
    const pitchedSet = new Set<string>()

    for (const lead of leads) {
      if (lead.initial_service) {
        const parsed = parseComboServices(lead.initial_service)
        for (const srv of parsed) {
          pitchedSet.add(srv)
          if (!leadCodesByService[srv] && lead.lead_code) {
            leadCodesByService[srv] = lead.lead_code
          }
        }
      }
      if (lead.current_service) {
        const parsed = parseComboServices(lead.current_service)
        for (const srv of parsed) {
          pitchedSet.add(srv)
          if (!leadCodesByService[srv] && lead.lead_code) {
            leadCodesByService[srv] = lead.lead_code
          }
        }
      }
    }

    // Also check lead_service_history
    const leadIds = leads.map((l) => l.id).filter(Boolean)
    if (leadIds.length > 0) {
      const { data: history } = await supabase
        .from('lead_service_history')
        .select('from_service, to_service, lead_id')
        .in('lead_id', leadIds)

      if (history) {
        for (const h of history) {
          if (h.from_service) {
            parseComboServices(h.from_service).forEach((s) => pitchedSet.add(s))
          }
          if (h.to_service) {
            parseComboServices(h.to_service).forEach((s) => pitchedSet.add(s))
          }
        }
      }
    }

    const pitchedServices = Array.from(pitchedSet)
    const availableServices = ALL_SERVICES.filter((srv) => !pitchedSet.has(srv))
    const allServicesPitched = availableServices.length === 0

    return {
      pitchedServices,
      leadCodesByService,
      availableServices,
      allServicesPitched,
    }
  } catch (err) {
    console.error('[getPitchedServicesForBusiness] Error:', err)
    return {
      pitchedServices: [],
      leadCodesByService: {},
      availableServices: [...ALL_SERVICES],
      allServicesPitched: false,
    }
  }
}

/**
 * Validates whether a given service can be pitched/created for a business
 */
export async function validateServiceAvailableForBusiness(
  businessName: string,
  service: string
): Promise<{ available: boolean; error?: string; existingLeadCode?: string }> {
  if (!businessName || !businessName.trim() || !service) {
    return { available: true }
  }

  const { pitchedServices, leadCodesByService } = await getPitchedServicesForBusiness(businessName)
  const targetServices = parseComboServices(service)

  for (const srv of targetServices) {
    if (pitchedServices.includes(srv)) {
      const code = leadCodesByService[srv]
      return {
        available: false,
        existingLeadCode: code,
        error: `"${businessName.trim()}" already has a lead associated with ${srv}${code ? ` (${code})` : ''} (even if previously pivoted). Each service can only be pitched once per business.`,
      }
    }
  }

  return { available: true }
}

