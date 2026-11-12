import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MetaTemplateStatus, metaOptionLabel } from '@/components/whatsapp/MetaTemplateStatus'

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('MetaTemplateStatus', () => {
  it('shows an approved template with no warning', () => {
    const t = text(renderToStaticMarkup(createElement(MetaTemplateStatus, { name: 'selfera_first_contact', status: 'APPROVED', outsideWindow: true, fromTemplate: true })))
    expect(t).toContain('selfera_first_contact')
    expect(t).toContain('Approved')
    expect(t).not.toContain('Can’t send')
  })

  it('warns when outside the 24-hour window and not approved', () => {
    const t = text(renderToStaticMarkup(createElement(MetaTemplateStatus, { name: 'selfera_offer', status: 'PENDING', outsideWindow: true, fromTemplate: true })))
    expect(t).toContain('In review')
    expect(t).toContain('Can’t send until it’s approved')
  })

  it('does not warn inside the 24-hour window', () => {
    const t = text(renderToStaticMarkup(createElement(MetaTemplateStatus, { name: 'selfera_offer', status: 'REJECTED', outsideWindow: false, fromTemplate: false })))
    expect(t).toContain('Rejected')
    expect(t).toContain('(default)')
    expect(t).not.toContain('Can’t send')
  })

  it('flags a template that is not one of ours', () => {
    const t = text(renderToStaticMarkup(createElement(MetaTemplateStatus, { name: 'cafe_promo', status: null, outsideWindow: true, fromTemplate: true })))
    expect(t).toContain('Not in this product')
    expect(t).toContain('Can’t send')
  })
})

describe('metaOptionLabel', () => {
  it('labels picker options', () => {
    expect(metaOptionLabel('APPROVED')).toBe('✓ Meta approved')
    expect(metaOptionLabel('PENDING')).toBe('Meta: in review')
    expect(metaOptionLabel('NONE')).toBe('Meta: not in this product')
    expect(metaOptionLabel(null)).toBe('default Meta template')
  })
})
