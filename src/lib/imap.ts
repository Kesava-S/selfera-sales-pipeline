import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Strips quoted email thread history (e.g. "On [Date], [Sender] wrote:",
 * "-----Original Message-----", and lines starting with ">")
 * so that only the user's actual reply is preserved.
 */
export function stripEmailQuotedText(text: string): string {
  if (!text) return ''

  const patterns = [
    // Gmail / Apple Mail: On [Date], [Name] <[email]> wrote:
    /\n\s*On\s+[\s\S]+?wrote:\s*[\s\S]*$/i,
    // Outlook: -----Original Message-----
    /\n\s*-+\s*Original Message\s*-+[\s\S]*$/i,
    // Outlook / Exchange: From: ... Sent: ...
    /\n\s*From:\s+[^\n]+\n\s*Sent:\s+[^\n]+[\s\S]*$/i,
    // French: Le ... a écrit :
    /\n\s*Le\s+[\s\S]+?a écrit\s*:[\s\S]*$/i,
    // German: Am ... schrieb ...:
    /\n\s*Am\s+[\s\S]+?schrieb\s+[\s\S]+?:[\s\S]*$/i,
  ]

  let cleaned = text
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Also strip any trailing quote lines starting with >
  const lines = cleaned.split('\n')
  const resultLines: string[] = []
  for (const line of lines) {
    if (/^\s*>/.test(line)) {
      break
    }
    resultLines.push(line)
  }

  const result = resultLines.join('\n').trim()
  return result || text.trim()
}

export function isImapConfigured(): boolean {
  return Boolean(process.env.IMAP_PASS || process.env.SMTP_PASS)
}

export interface SyncResult {
  ok: boolean
  totalChecked: number
  matched: number
  unmatched: number
  errors: string[]
}

/**
 * Connects to Gmail / Google Workspace IMAP for support@selfera.co.uk,
 * checks for inbound emails, parses them, and invokes "sales-pipe".record_inbound(...)
 * for any emails from registered leads.
 */
export async function syncEmailReplies(options?: {
  unseenOnly?: boolean
  markAsSeen?: boolean
  maxMessages?: number
  sinceDays?: number
}): Promise<SyncResult> {
  const host = process.env.IMAP_HOST || 'imap.gmail.com'
  const port = parseInt(process.env.IMAP_PORT || '993', 10)
  const secure = process.env.IMAP_SECURE !== 'false'
  const user = (process.env.IMAP_USER || process.env.SMTP_USER || 'support@selfera.co.uk').trim()
  const pass = (process.env.IMAP_PASS || process.env.SMTP_PASS || '').trim()

  if (!pass) {
    throw new Error('IMAP_PASS or SMTP_PASS is not configured in .env')
  }

  const unseenOnly = options?.unseenOnly ?? true
  const markAsSeen = options?.markAsSeen ?? true
  const maxMessages = options?.maxMessages ?? 50
  const sinceDays = options?.sinceDays ?? 3

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  })

  const errors: string[] = []
  let totalChecked = 0
  let matched = 0
  let unmatched = 0

  await client.connect()
  const lock = await client.getMailboxLock('INBOX')

  try {
    const supabase = createServiceClient()

    // 1. Search criteria
    let uids: number[] = []
    if (unseenOnly) {
      const searchRes = await client.search({ seen: false })
      uids = Array.isArray(searchRes) ? searchRes : []
    } else {
      const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
      const searchRes = await client.search({ since: sinceDate })
      uids = Array.isArray(searchRes) ? searchRes : []
    }

    if (!uids || uids.length === 0) {
      return { ok: true, totalChecked: 0, matched: 0, unmatched: 0, errors: [] }
    }

    // Limit to latest N messages
    const targetUids = uids.slice(-maxMessages)

    for (const uid of targetUids) {
      totalChecked++
      try {
        const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true })
        if (!msg || !msg.source) continue

        const parsed = await simpleParser(msg.source)
        const fromAddress = parsed.from?.value?.[0]?.address?.trim().toLowerCase()
        if (!fromAddress) continue

        // Skip emails sent from our own address
        if (fromAddress === user.toLowerCase()) {
          continue
        }

        const messageId = parsed.messageId || `<uid-${uid}@selfera.co.uk>`
        const inReplyTo =
          parsed.inReplyTo ||
          (Array.isArray(parsed.references) ? parsed.references[0] : parsed.references) ||
          null

        // Clean body text (strip excessive whitespace and collapsed email thread history)
        let rawBody = (parsed.text || '').trim()
        if (!rawBody && parsed.html) {
          rawBody = parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }

        let body = stripEmailQuotedText(rawBody)
        if (!body) {
          body = rawBody || `[Empty email or attachment received from ${fromAddress}]`
        }

        // Check if message was already imported previously
        const { data: existing } = await supabase
          .from('messages')
          .select('id')
          .eq('external_message_id', messageId)
          .maybeSingle()

        if (existing) {
          // Already in database from previous sync, skip duplicate processing
          continue
        }

        // Call database record_inbound
        const { error: rpcError } = await supabase.rpc('record_inbound', {
          p_platform: 'Email',
          p_external_thread_id: inReplyTo,
          p_from: fromAddress,
          p_body: body,
          p_external_message_id: messageId,
          p_media_url: null,
        })

        if (rpcError) {
          errors.push(`UID ${uid} (${fromAddress}): ${rpcError.message}`)
          continue
        }

        // Check if the message was successfully stored in "sales-pipe".messages
        const { data: stored } = await supabase
          .from('messages')
          .select('id')
          .eq('external_message_id', messageId)
          .maybeSingle()

        if (stored) {
          matched++
        } else {
          unmatched++
        }

        // Mark as seen in Gmail if requested
        if (markAsSeen) {
          await client.messageFlagsAdd({ uid }, ['\\Seen'])
        }
      } catch (err: any) {
        errors.push(`UID ${uid}: ${err?.message || String(err)}`)
      }
    }
  } finally {
    lock.release()
    await client.logout().catch(() => {})
  }

  return {
    ok: errors.length === 0,
    totalChecked,
    matched,
    unmatched,
    errors,
  }
}
