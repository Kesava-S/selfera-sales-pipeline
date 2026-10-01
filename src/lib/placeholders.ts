// Fill template placeholders. Same names as the database (generate_draft).
export const PLACEHOLDERS = ['{business_name}', '{sender_name}', '{area}', '{contact_name}'] as const

export function fillPlaceholders(
  text: string,
  values: { business_name?: string | null; sender_name?: string | null; area?: string | null; contact_name?: string | null }
): string {
  const first = (values.sender_name || '').split(' ')[0]
  return (text || '')
    .replaceAll('{business_name}', values.business_name || '{business_name}')
    .replaceAll('{business}', values.business_name || '{business_name}')
    .replaceAll('{sender_name}', first || '{sender_name}')
    .replaceAll('{area}', values.area || '{area}')
    .replaceAll('{contact_name}', values.contact_name || '{contact_name}')
}

export function missingPlaceholders(text: string): string[] {
  return Array.from(new Set((text || '').match(/\{[a-z_]+\}/g) || []))
}
