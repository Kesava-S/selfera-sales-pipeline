// Plain-words reasons for the WhatsApp (Meta) errors we see most. Our saved error
// text starts with "(#code)"; anything unknown is shown as Meta wrote it.

const REASONS: Record<number, string> = {
  131049: 'Meta limited marketing messages to this number. Try again later; don’t resend now.',
  131050: 'They turned off marketing messages from this business in WhatsApp.',
  131026: 'Couldn’t deliver: the number may not be on WhatsApp, or can’t receive messages right now.',
  131047: 'More than 24 hours since they last wrote. Send an approved Meta template instead.',
  131051: 'This message type isn’t supported.',
  131053: 'The attached media couldn’t be sent.',
  130472: 'Meta held this message back for this number (part of a Meta experiment).',
  131056: 'Too many messages to this number in a short time. Wait a while before sending again.',
  132000: 'The template’s variables didn’t match. Check the variables in Templates → WhatsApp.',
  132001: 'This Meta template doesn’t exist in that language.',
  132005: 'The template text was too long after filling in the variables.',
  132007: 'Meta rejected the template’s wording.',
  132012: 'A variable value was in the wrong format.',
  132015: 'This Meta template is paused because of low quality.',
  132016: 'This Meta template is disabled.',
  132018: 'A variable had new lines or too many spaces.',
  133010: 'This WhatsApp number isn’t registered with Meta yet.',
}

export function metaErrorCode(detail?: string | null): number | null {
  const m = detail?.match(/\(#(\d+)\)/)
  return m ? Number(m[1]) : null
}

// { text: what to show, raw: Meta's own wording for a tooltip }
export function friendlyMetaError(detail?: string | null): { text: string; raw: string } {
  const raw = (detail || '').trim()
  const code = metaErrorCode(raw)
  return { text: (code && REASONS[code]) || raw || 'Not delivered.', raw }
}
