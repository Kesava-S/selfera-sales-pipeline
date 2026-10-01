// Which send button a thread gets. Used by the chat screen AND checked again by /api/send.
// Rule: nothing is ever sent without a person clicking.

export type SendMode =
  | 'api'            // Send through the platform API (n8n)
  | 'api-template'   // WhatsApp approved template through the API
  | 'manual'         // Copy, open the app, then "Mark as sent"
  | 'log'            // Phone / Walk-in: write what happened, then "Mark as done"
  | 'blocked'        // Opted out / Do not contact

export type SendRule = { mode: SendMode; windowOpen: boolean; reason: string }

export const REPLY_WINDOW_HOURS = 24
export const HUMAN_AGENT_WINDOW_HOURS = 24 * 7

export function hoursSince(iso?: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

export function getSendRule(opts: {
  platform: string
  threadStatus: string
  stage: string
  lastInboundAt?: string | null
  apiPlatforms: string[]        // platforms connected through n8n (server env SEND_API_PLATFORMS)
  whatsappTemplateName?: string | null
  humanAgent?: boolean          // Meta "human agent" tag allows 7 days on Instagram / Facebook
}): SendRule {
  const { platform, threadStatus, stage, lastInboundAt, apiPlatforms, whatsappTemplateName, humanAgent } = opts

  if (stage === 'Do not contact' || threadStatus === 'Opted out') {
    return { mode: 'blocked', windowOpen: false, reason: 'This business asked not to be contacted.' }
  }
  if (platform === 'Phone' || platform === 'Walk-in') {
    return { mode: 'log', windowOpen: true, reason: platform === 'Phone' ? 'Call them, then log what happened.' : 'Visit, then log what happened.' }
  }

  const connected = apiPlatforms.includes(platform)
  const hours = hoursSince(lastInboundAt)

  if (platform === 'Email') {
    return connected
      ? { mode: 'api', windowOpen: true, reason: 'Sends from the Selfera mailbox.' }
      : { mode: 'manual', windowOpen: true, reason: 'Email sending is not connected yet. Open it in your email app, send, then mark as sent.' }
  }

  if (platform === 'WhatsApp') {
    const open = hours <= REPLY_WINDOW_HOURS
    if (connected && open) return { mode: 'api', windowOpen: true, reason: 'They messaged in the last 24 hours, so you can reply here.' }
    if (connected && whatsappTemplateName) return { mode: 'api-template', windowOpen: false, reason: `Outside the 24-hour window. Sends the approved template "${whatsappTemplateName}".` }
    return {
      mode: 'manual',
      windowOpen: open,
      reason: connected
        ? 'Window closed, reply in the app. WhatsApp only allows free messages within 24 hours of their last message.'
        : 'WhatsApp sending is not connected yet. Copy and open WhatsApp, send, then mark as sent.',
    }
  }

  // Instagram and Facebook: the API can only reply, never start a conversation
  const limit = humanAgent ? HUMAN_AGENT_WINDOW_HOURS : REPLY_WINDOW_HOURS
  const open = hours <= limit
  if (connected && open) return { mode: 'api', windowOpen: true, reason: `They messaged in the last ${humanAgent ? '7 days' : '24 hours'}, so you can reply here.` }
  return {
    mode: 'manual',
    windowOpen: false,
    reason: !connected
      ? `${platform} sending is not connected yet. Copy and open ${platform}, send, then mark as sent.`
      : lastInboundAt
        ? 'Window closed, reply in the app.'
        : `${platform} doesn't allow businesses to send the first message through the API. Copy and open ${platform}, send, then mark as sent.`,
  }
}

export function needsPecrConfirm(platform: string, companyType?: string | null): boolean {
  return platform === 'Email' && (companyType === 'Sole trader' || companyType === 'Partnership')
}

export function parseApiPlatforms(value?: string): string[] {
  return (value || '').split(',').map(s => s.trim()).filter(Boolean)
}
