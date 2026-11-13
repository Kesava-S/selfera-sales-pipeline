// Meta WhatsApp template shapes, plus building and checking a template before it is
// sent to Meta. No server code here, so the editor screen can use it too.

export type MetaCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

export type MetaButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example?: string[] }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string }

export type MetaComponent =
  | { type: 'HEADER'; format: 'TEXT'; text: string; example?: { header_text: string[] } }
  | { type: 'BODY'; text: string; example?: { body_text: string[][] } }
  | { type: 'FOOTER'; text: string }
  | { type: 'BUTTONS'; buttons: MetaButton[] }

export type MetaTemplate = {
  id: string
  name: string
  status: string
  category: MetaCategory
  language: string
  components: MetaComponent[]
  rejected_reason?: string | null
  quality_score?: { score?: string } | null
}

export type TemplateDraft = {
  name: string
  language: string
  category: MetaCategory
  header?: string
  headerExample?: string
  body: string
  bodyExamples: string[]
  footer?: string
  buttons: MetaButton[]
}

const VARS = /\{\{(\d+)\}\}/g
export const variablesIn = (text: string) => [...new Set([...text.matchAll(VARS)].map(m => Number(m[1])))].sort((a, b) => a - b)

// The problems Meta would reject it for, in plain words (empty = fine)
export function checkDraft(d: TemplateDraft): string[] {
  const out: string[] = []
  if (!/^[a-z0-9_]{1,512}$/.test(d.name)) out.push('Name: lowercase letters, numbers and underscores only (e.g. selfera_first_contact).')
  if (!d.language) out.push('Pick a language.')
  if (!d.body.trim()) out.push('Write the message body.')
  if (d.body.length > 1024) out.push(`Body is ${d.body.length} characters; the limit is 1024.`)
  const vars = variablesIn(d.body)
  if (vars.some((v, i) => v !== i + 1)) out.push('Number the body variables without gaps: {{1}}, {{2}}, {{3}}…')
  if (vars.some((_, i) => !d.bodyExamples[i]?.trim())) out.push('Give an example value for every body variable; Meta needs them to review it.')
  if (/^\s*\{\{\d+\}\}/.test(d.body) || /\{\{\d+\}\}[\s.!?]*$/.test(d.body)) out.push('The body can’t start or end with a variable; Meta rejects that.')
  if (vars.length && d.body.replace(VARS, '').trim().split(/\s+/).length < vars.length * 3) out.push('Too many variables for the amount of text; add more fixed wording.')
  if (d.header) {
    if (d.header.length > 60) out.push('Header is limited to 60 characters.')
    const hv = variablesIn(d.header)
    if (hv.length > 1 || (hv.length === 1 && hv[0] !== 1)) out.push('The header can have one variable, {{1}}.')
    if (hv.length && !d.headerExample?.trim()) out.push('Give an example value for the header variable.')
  }
  if (d.footer && d.footer.length > 60) out.push('Footer is limited to 60 characters.')
  if (d.footer && variablesIn(d.footer).length) out.push('The footer can’t have variables.')
  if (d.buttons.length > 3) out.push('Use at most 3 buttons.')
  for (const b of d.buttons) {
    if (!b.text.trim()) out.push('Every button needs a label.')
    if (b.text.length > 25) out.push(`Button "${b.text}" is longer than 25 characters.`)
    if (b.type === 'URL' && !/^https:\/\//.test(b.url)) out.push(`Button "${b.text}" needs a link starting with https://.`)
    if (b.type === 'PHONE_NUMBER' && !/^\+\d{8,15}$/.test(b.phone_number)) out.push(`Button "${b.text}" needs a phone number with its country code, like +<country code><number>.`)
  }
  return out
}

export function toComponents(d: TemplateDraft): MetaComponent[] {
  const c: MetaComponent[] = []
  if (d.header?.trim()) {
    c.push({ type: 'HEADER', format: 'TEXT', text: d.header.trim(), ...(variablesIn(d.header).length ? { example: { header_text: [d.headerExample!.trim()] } } : {}) })
  }
  const n = variablesIn(d.body).length
  c.push({ type: 'BODY', text: d.body.trim(), ...(n ? { example: { body_text: [d.bodyExamples.slice(0, n).map(e => e.trim())] } } : {}) })
  if (d.footer?.trim()) c.push({ type: 'FOOTER', text: d.footer.trim() })
  if (d.buttons.length) c.push({ type: 'BUTTONS', buttons: d.buttons.map(b => ({ ...b, text: b.text.trim() })) })
  return c
}

// Back from Meta's components to the editor's fields
export function fromComponents(t: { name: string; language: string; category: MetaCategory; components: MetaComponent[] }): TemplateDraft {
  const header = t.components.find(c => c.type === 'HEADER') as Extract<MetaComponent, { type: 'HEADER' }> | undefined
  const body = t.components.find(c => c.type === 'BODY') as Extract<MetaComponent, { type: 'BODY' }> | undefined
  const footer = t.components.find(c => c.type === 'FOOTER') as Extract<MetaComponent, { type: 'FOOTER' }> | undefined
  const buttons = t.components.find(c => c.type === 'BUTTONS') as Extract<MetaComponent, { type: 'BUTTONS' }> | undefined
  return {
    name: t.name,
    language: t.language,
    category: t.category,
    header: header?.text ?? '',
    headerExample: header?.example?.header_text?.[0] ?? '',
    body: body?.text ?? '',
    bodyExamples: body?.example?.body_text?.[0] ?? [],
    footer: footer?.text ?? '',
    buttons: buttons?.buttons ?? [],
  }
}

// ---------- Variables: what fills each {{n}} when sending ----------

// The lead details a variable can be filled from
export const VAR_KEYS = ['contact_name', 'business_name', 'area', 'sender_name', 'message'] as const
export type VarKey = (typeof VAR_KEYS)[number]
export const VAR_LABELS: Record<VarKey, string> = {
  contact_name: 'Contact name',
  business_name: 'Business name',
  area: 'Area',
  sender_name: 'Your first name',
  message: 'The whole typed message',
}
// Used when a lead has no value, so the template still sends
export const VAR_FALLBACKS: Record<VarKey, string> = {
  contact_name: 'there',
  business_name: 'your business',
  area: 'your area',
  sender_name: 'the Selfera team',
  message: 'Hello from Selfera',
}
const VAR_EXAMPLES: Record<VarKey, string> = {
  contact_name: 'Priya',
  business_name: 'The Olive Tree',
  area: 'Manchester',
  sender_name: 'Alex',
  message: 'Hello',
}

export type VariableMap = { body: VarKey[]; header?: VarKey | null }

// Our placeholders (as written in outreach templates) and the key each fills from
const PLACEHOLDER_KEYS: Record<string, VarKey> = {
  '{contact_name}': 'contact_name', '{first_name}': 'contact_name',
  '{business_name}': 'business_name', '{business}': 'business_name',
  '{area}': 'area', '{sender_name}': 'sender_name',
}

export const metaNameFrom = (label: string) =>
  ('selfera_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')).slice(0, 60)

// An outreach template's text → a Meta draft: {contact_name} etc. become {{1}}, {{2}}…
// in the order they first appear, with example values, plus the map to fill them back in
export function draftFromMessage(text: string, label: string): { draft: TemplateDraft; map: VariableMap } {
  const order: VarKey[] = []
  const body = (text || '').trim().replace(/\{[a-z_]+\}/g, ph => {
    const key = PLACEHOLDER_KEYS[ph]
    if (!key) return ph
    let i = order.indexOf(key)
    if (i < 0) { order.push(key); i = order.length - 1 }
    return `{{${i + 1}}}`
  })
  return {
    draft: {
      name: metaNameFrom(label), language: 'en_GB', category: 'MARKETING', header: '', headerExample: '',
      body, bodyExamples: order.map(k => VAR_EXAMPLES[k]), footer: '', buttons: [{ type: 'QUICK_REPLY', text: 'Stop messages' }],
    },
    map: { body: order },
  }
}

// Meta rejects parameters with new lines, tabs or more than 4 spaces in a row
export const cleanParam = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

// The values to send for one lead, in {{n}} order
export function paramsFor(map: VariableMap, count: number, values: Partial<Record<VarKey, string | null | undefined>>): string[] {
  return Array.from({ length: count }, (_, i) => {
    const key = map.body[i] ?? 'message'
    return cleanParam(values[key] || '') || VAR_FALLBACKS[key]
  })
}

// The template text as the lead will read it (saved as the sent message)
export function renderTemplate(components: MetaComponent[], body: string[], header?: string | null) {
  const fill = (t: string, vals: string[]) => t.replace(/\{\{(\d+)\}\}/g, (m, n) => vals[Number(n) - 1] ?? m)
  const h = components.find(c => c.type === 'HEADER') as { text?: string } | undefined
  const b = components.find(c => c.type === 'BODY') as { text?: string } | undefined
  const f = components.find(c => c.type === 'FOOTER') as { text?: string } | undefined
  return [h?.text ? `*${fill(h.text, header ? [header] : [])}*` : '', fill(b?.text ?? '', body), f?.text ?? ''].filter(Boolean).join('\n\n')
}
