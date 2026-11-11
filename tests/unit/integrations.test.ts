import { describe, it, expect } from 'vitest'
import { CHANNELS } from '@/components/integrations/integrationsData'

describe('Dynamic Integrations Module', () => {
  it('contains strictly the 5 channels: WhatsApp, Email, Instagram, Facebook, and LinkedIn', () => {
    const ids = CHANNELS.map(i => i.id)
    expect(ids).toEqual(['whatsapp', 'email', 'instagram', 'facebook', 'linkedin'])
  })

  it('every channel has valid structure, config, and fields without clutter', () => {
    for (const ch of CHANNELS) {
      expect(ch.id).toBeTruthy()
      expect(ch.name).toBeTruthy()
      expect(ch.provider).toBeTruthy()
      expect(['connected', 'disconnected']).toContain(ch.status)
      expect(ch.fields.length).toBeGreaterThan(0)
      expect(ch.config).toBeDefined()
    }
  })

  it('WhatsApp and Email have webhook URLs configured', () => {
    const wa = CHANNELS.find(c => c.id === 'whatsapp')
    const em = CHANNELS.find(c => c.id === 'email')
    expect(wa?.webhookUrl).toContain('/api/whatsapp/webhook')
    expect(em?.webhookUrl).toContain('/api/email/webhook')
  })

  it('WhatsApp channel supports multiple message templates in its config', () => {
    const wa = CHANNELS.find(c => c.id === 'whatsapp')
    expect(wa?.config.default_template_name).toBe('selfera_sales_pipeline_general')
    expect(Array.isArray(wa?.config.templates)).toBe(true)
    expect(wa?.config.templates).toContain('selfera_sales_pipeline_general')
  })
})
