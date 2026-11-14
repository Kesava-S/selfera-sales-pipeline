import { describe, expect, it } from 'vitest'
import { personalise } from '@/lib/campaignQueue'

describe('Campaign Variable Personalisation (personalise)', () => {
  it('correctly replaces {sender_name} with sender name', () => {
    const text = "I'm {sender_name} from Selfera.\n\nBest regards,\n{sender_name}"
    const recipient = {
      id: 'rec-1',
      channel: 'email' as const,
      campaign_id: 'camp-1',
      email: 'owner@krishhomestays.co.uk',
      phone: null,
      business_name: 'Krish Homestays',
      contact_name: 'Krish',
      attempts: 0,
    }
    const result = personalise(text, recipient, 'General', 'Kesav S')
    expect(result).toBe("I'm Kesav from Selfera.\n\nBest regards,\nKesav")
    expect(result).not.toContain('{sender_name}')
  })

  it('correctly personalises the exact template from the screenshot', () => {
    const template = `Hi {business_name} team,

I'm {sender_name} from Selfera. We help independent businesses automate bookings, guest messages, review requests and reporting, so the team spends less time on admin. Would a short call be useful?

{sender_name}
Selfera
Reply STOP and I won't contact you again. {business_name}`

    const recipient = {
      id: 'rec-2',
      channel: 'email' as const,
      campaign_id: 'camp-2',
      email: 'stay@krishhomestays.com',
      phone: null,
      business_name: 'Krish Homestays',
      contact_name: null,
      area: 'Brighton',
      attempts: 0,
    }

    const result = personalise(template, recipient, 'Website Automation', 'Sam Taylor')

    expect(result).toContain('Hi Krish Homestays team,')
    expect(result).toContain("I'm Sam from Selfera.")
    expect(result).toContain('Sam\nSelfera')
    expect(result).toContain("Reply STOP and I won't contact you again. Krish Homestays")
    expect(result).not.toContain('{sender_name}')
    expect(result).not.toContain('{business_name}')
  })

  it('replaces {area} with recipient area or fallback', () => {
    const withArea = personalise(
      'Places in {area}',
      {
        id: 'rec-3',
        channel: 'email' as const,
        campaign_id: 'camp-3',
        email: 'test@example.com',
        phone: null,
        business_name: 'Cafe Nero',
        contact_name: 'Alex',
        area: 'Kensington',
        attempts: 0,
      },
      null,
      'John'
    )
    expect(withArea).toBe('Places in Kensington')

    const fallbackArea = personalise(
      'Places in {area}',
      {
        id: 'rec-4',
        channel: 'email' as const,
        campaign_id: 'camp-4',
        email: 'test@example.com',
        phone: null,
        business_name: 'Cafe Nero',
        contact_name: 'Alex',
        area: null,
        attempts: 0,
      },
      null,
      'John'
    )
    expect(fallbackArea).toBe('Places in your area')
  })

  it('falls back to default Selfera when sender name is not provided', () => {
    const text = "I'm {sender_name} from Selfera."
    const recipient = {
      id: 'rec-5',
      channel: 'email' as const,
      campaign_id: 'camp-5',
      email: 'test@example.com',
      phone: null,
      business_name: 'Test Business',
      contact_name: 'Owner',
      attempts: 0,
    }
    const result = personalise(text, recipient)
    expect(result).toBe("I'm Selfera from Selfera.")
    expect(result).not.toContain('{sender_name}')
  })
})
