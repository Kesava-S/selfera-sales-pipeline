// Links for contacting a business outside the app (manual sending)

export function ukToInternational(phone?: string | null): string | null {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '44' + d.slice(1)
  return d.length >= 10 ? d : null
}

export function isUkMobile(phone?: string | null): boolean {
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
  return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null
}

export function websiteLink(site?: string | null): string | null {
  if (!site || !/\./.test(site) || /\s/.test(site)) return null
  return /^https?:\/\//.test(site) ? site : `https://${site}`
}
