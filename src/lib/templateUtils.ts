import type { TemplateChannel, CadenceStep, Template } from '@/types/database'

export interface StepInfo {
  step: CadenceStep
  name: string
  shortLabel: string
  visibilityRule: string
  description: string
  timing: string
}

export const CADENCE_STEPS: Record<CadenceStep, StepInfo> = {
  0: {
    step: 0,
    name: 'Follow up 0 (Initial Outreach)',
    shortLabel: 'Step 0: Initial Outreach',
    visibilityRule: 'Available for New leads',
    description: 'First outreach message. Sends to new prospect and updates stage from New to Contacted.',
    timing: 'Day 0',
  },
  1: {
    step: 1,
    name: 'Follow up 1',
    shortLabel: 'Step 1: Follow-up 1',
    visibilityRule: 'Only visible after Step 0 is complete',
    description: 'First follow-up sent +3 working days after initial outreach.',
    timing: '+3 working days',
  },
  2: {
    step: 2,
    name: 'Follow up 2',
    shortLabel: 'Step 2: Follow-up 2',
    visibilityRule: 'Only visible after Step 1 is complete',
    description: 'Second follow-up sent +5 working days after follow-up 1.',
    timing: '+5 working days',
  },
  3: {
    step: 3,
    name: 'Final Message',
    shortLabel: 'Step 3: Final Message',
    visibilityRule: 'Only visible after Step 2 is complete',
    description: 'Closing the loop message sent +14 working days after follow-up 2.',
    timing: '+14 working days',
  },
}

export function getLeadCadenceStep(lead: { stage: string; follow_up_count?: number | null }): CadenceStep {
  if (lead.stage === 'New' || !lead.follow_up_count || lead.follow_up_count === 0) {
    return 0
  }
  if (lead.follow_up_count === 1) {
    return 1
  }
  if (lead.follow_up_count === 2) {
    return 2
  }
  return 3
}

export function parseTemplateStep(
  name: string,
  explicitStep?: number | null
): CadenceStep {
  if (explicitStep === 0 || explicitStep === 1 || explicitStep === 2 || explicitStep === 3) {
    return explicitStep as CadenceStep
  }
  const lower = name.toLowerCase()
  if (
    lower.includes('step 0') ||
    lower.includes('follow up 0') ||
    lower.includes('follow-up 0') ||
    lower.includes('initial') ||
    lower.includes('intro') ||
    lower.includes('day 0')
  ) {
    return 0
  }
  if (
    lower.includes('step 1') ||
    lower.includes('follow up 1') ||
    lower.includes('follow-up 1') ||
    lower.includes('day 3') ||
    lower.includes('check-in')
  ) {
    return 1
  }
  if (
    lower.includes('step 2') ||
    lower.includes('follow up 2') ||
    lower.includes('follow-up 2') ||
    lower.includes('day 8') ||
    lower.includes('demo') ||
    lower.includes('streamlining')
  ) {
    return 2
  }
  if (
    lower.includes('step 3') ||
    lower.includes('final message') ||
    lower.includes('final check') ||
    lower.includes('day 22') ||
    lower.includes('closing') ||
    lower.includes('breakup')
  ) {
    return 3
  }
  return 0
}

export function parseTemplateChannel(
  name: string,
  explicitChannel?: string | null
): { channel: TemplateChannel; cleanName: string } {
  if (
    explicitChannel &&
    ['WhatsApp', 'Instagram', 'SMS', 'Facebook', 'Email', 'All'].includes(explicitChannel)
  ) {
    return {
      channel: explicitChannel as TemplateChannel,
      cleanName: name.replace(/^\[(WhatsApp|Instagram|SMS|Facebook|Email|All)\]\s*/i, '').trim(),
    }
  }

  const match = name.match(/^\[(WhatsApp|Instagram|SMS|Facebook|Email|All)\]\s*(.*)$/i)
  if (match) {
    const rawChan = match[1].toLowerCase()
    let chan: TemplateChannel = 'All'
    if (rawChan === 'whatsapp') chan = 'WhatsApp'
    else if (rawChan === 'instagram') chan = 'Instagram'
    else if (rawChan === 'sms') chan = 'SMS'
    else if (rawChan === 'facebook') chan = 'Facebook'
    else if (rawChan === 'email') chan = 'Email'
    return { channel: chan, cleanName: (match[2] || name).trim() }
  }

  return { channel: 'All', cleanName: name }
}

export function formatTemplateNameWithChannel(
  cleanName: string,
  channel: TemplateChannel
): string {
  const stripped = cleanName
    .replace(/^\[(WhatsApp|Instagram|SMS|Facebook|Email|All)\]\s*/i, '')
    .trim()
  if (channel === 'All') return stripped
  return `[${channel}] ${stripped}`
}

export function cleanTemplateText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '  ')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
}

/**
 * Sanitizes template input text in real time:
 * - Unescapes any literal "\n" or "\r\n" to actual real linebreaks
 * - Strips backslashes (\)
 * - Disallows unwanted special characters (<, >, control codes)
 */
export function sanitizeTemplateInput(text: string): string {
  if (!text) return ''
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\/g, '')
    .replace(/[<>\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Sanitizes custom variable names:
 * Allows only lowercase letters, numbers, and underscores (e.g. "service_name")
 */
export function sanitizeVariableName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '')
}


