// Links and validation for contacting a business outside the app

export type PhoneValidationResult =
  | { valid: true; normalized: string; error?: never }
  | { valid: true; normalized: null; error?: never }
  | { valid: false; normalized: null; error: string }

/**
 * Validates that a phone number explicitly includes the +44 or +0 country code:
 * - Allowed: +44... (e.g. +44 7123 456789) or +0... (e.g. +07123 456789, +020 7946 0991)
 *
 * If +44 or +0 is NOT present, returns an error and does NOT auto-add them.
 */
export function parseAndValidatePhone(raw?: string | null): PhoneValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: true, normalized: null }
  }

  const trimmed = raw.trim()
  const noSpace = trimmed.replace(/[\s()-]/g, '')

  // 1. Explicit +44 prefix
  if (noSpace.startsWith('+44')) {
    let digits = noSpace.slice(1).replace(/\D/g, '') // e.g. 447123456789
    // Clean domestic trunk zero if user wrote +44(0)7... -> +4407...
    if (digits.startsWith('440') && digits.length >= 12) {
      digits = '44' + digits.slice(3)
    }
    const after44 = digits.slice(2)
    if (after44.length < 9) {
      return { valid: false, normalized: null, error: 'Phone number is too short (UK numbers need 10-11 digits)' }
    }
    if (after44.length > 10) {
      return { valid: false, normalized: null, error: 'Phone number is too long (UK numbers need 10-11 digits)' }
    }
    return { valid: true, normalized: `+${digits}` }
  }

  // 2. Explicit +0 prefix
  if (noSpace.startsWith('+0')) {
    const digits = noSpace.slice(1).replace(/\D/g, '') // e.g. 07123456789
    if (digits.length < 10) {
      return { valid: false, normalized: null, error: 'Phone number is too short (UK numbers need 10-11 digits)' }
    }
    if (digits.length > 11) {
      return { valid: false, normalized: null, error: 'Phone number is too long (UK numbers need 10-11 digits)' }
    }
    return { valid: true, normalized: `+${digits}` }
  }

  // 3. Other international numbers with '+' (e.g. +91...)
  if (noSpace.startsWith('+')) {
    const digits = noSpace.slice(1).replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) {
      return { valid: false, normalized: null, error: 'Invalid international phone number length' }
    }
    return { valid: true, normalized: `+${digits}` }
  }

  // 4. Without '+' symbol, but starting with international '00'
  if (noSpace.startsWith('00')) {
    const digits = noSpace.slice(2).replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) {
      return { valid: false, normalized: null, error: 'Invalid international phone number length' }
    }
    return { valid: true, normalized: `+${digits}` }
  }

  // 5. Without '+' symbol, but with UK country code '44'
  if (noSpace.startsWith('44')) {
    let digits = noSpace.replace(/\D/g, '')
    if (digits.startsWith('440') && digits.length >= 12) {
      digits = '44' + digits.slice(3)
    }
    const after44 = digits.slice(2)
    if (after44.length < 9) {
      return { valid: false, normalized: null, error: 'Phone number is too short (UK numbers need 10-11 digits)' }
    }
    if (after44.length > 10) {
      return { valid: false, normalized: null, error: 'Phone number is too long (UK numbers need 10-11 digits)' }
    }
    return { valid: true, normalized: `+${digits}` }
  }

  // 6. Without '+' symbol, with UK national / trunk code '0' (e.g. 07..., 02..., 01...)
  if (noSpace.startsWith('0')) {
    const digits = noSpace.replace(/\D/g, '')
    if (digits.length < 10) {
      return { valid: false, normalized: null, error: 'Phone number is too short (UK numbers need 10-11 digits)' }
    }
    if (digits.length > 11) {
      return { valid: false, normalized: null, error: 'Phone number is too long (UK numbers need 10-11 digits)' }
    }
    return { valid: true, normalized: digits }
  }

  // Missing country code (e.g. 7514 953005, bare digits): reject with error
  return {
    valid: false,
    normalized: null,
    error: 'Phone must include country code (e.g. +44, 44, or 0...)',
  }
}

export function ukToInternational(phone?: string | null): string | null {
  if (!phone) return null
  const res = parseAndValidatePhone(phone)
  if (res.valid && res.normalized) {
    if (res.normalized.startsWith('+44')) return res.normalized.slice(1)
    if (res.normalized.startsWith('+0')) return '44' + res.normalized.slice(2)
    if (res.normalized.startsWith('0')) return '44' + res.normalized.slice(1)
    if (res.normalized.startsWith('44')) return res.normalized
    return res.normalized.replace(/^\+/, '')
  }
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '44' + d.slice(1)
  return d.length >= 10 ? d : null
}

export function isUkMobile(phone?: string | null): boolean {
  if (!phone) return false
  const res = parseAndValidatePhone(phone)
  if (res.valid && res.normalized) {
    return (
      res.normalized.startsWith('+447') ||
      res.normalized.startsWith('447') ||
      res.normalized.startsWith('+07') ||
      res.normalized.startsWith('07')
    )
  }
  const d = ukToInternational(phone)
  return !!d && d.startsWith('447')
}

export function whatsappLink(phone?: string | null, text?: string): string | null {
  const n = ukToInternational(phone)
  if (!n) return null
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function instagramLink(handle?: string | null): string | null {
  return handle ? `https://www.instagram.com/${handle.replace(/^@/, '')}/` : null
}

export function facebookLink(page?: string | null): string | null {
  if (!page) return null
  return /^https?:\/\//.test(page) ? page : `https://www.facebook.com/${page}`
}

export function mailtoLink(email?: string | null, subject?: string, body?: string): string | null {
  if (!email) return null
  const q = new URLSearchParams()
  if (subject) q.set('subject', subject)
  if (body) q.set('body', body)
  return `mailto:${email}?${q.toString().replace(/\+/g, '%20')}`
}

export function telLink(phone?: string | null): string | null {
  if (!phone) return null
  const res = parseAndValidatePhone(phone)
  if (res.valid && res.normalized) {
    return `tel:${res.normalized}`
  }
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function websiteLink(site?: string | null): string | null {
  if (!site || !/\./.test(site) || /\s/.test(site)) return null
  return /^https?:\/\//.test(site) ? site : `https://${site}`
}
