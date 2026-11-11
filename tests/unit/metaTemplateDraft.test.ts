import { describe, expect, it } from 'vitest'
import { checkDraft, draftFromMessage, metaNameFrom, paramsFor, renderTemplate, toComponents } from '@/lib/metaTemplateDraft'

describe('draftFromMessage', () => {
  it('turns our placeholders into numbered variables in order of first use', () => {
    const { draft, map } = draftFromMessage('Hi {contact_name}, I came across {business_name} while looking at places in {area} and had a quick idea to share. Thanks {contact_name}, {sender_name} from Selfera.', 'General Intro')
    expect(draft.body).toBe('Hi {{1}}, I came across {{2}} while looking at places in {{3}} and had a quick idea to share. Thanks {{1}}, {{4}} from Selfera.')
    expect(map.body).toEqual(['contact_name', 'business_name', 'area', 'sender_name'])
    expect(draft.bodyExamples).toHaveLength(4)
    expect(draft.name).toBe('selfera_general_intro')
    expect(checkDraft(draft)).toEqual([])
  })

  it('treats {business} like {business_name} and leaves unknown placeholders', () => {
    const { draft, map } = draftFromMessage('Hello {business} team, about {unknown} we can help {business_name}.', 'x')
    expect(draft.body).toBe('Hello {{1}} team, about {unknown} we can help {{1}}.')
    expect(map.body).toEqual(['business_name'])
  })

  it('builds a valid Meta name', () => {
    expect(metaNameFrom('Cafés & Bars — Follow-up 2')).toBe('selfera_caf_s_bars_follow_up_2')
  })
})

describe('paramsFor', () => {
  it('fills each variable from the lead, with fallbacks and Meta-safe text', () => {
    const vals = paramsFor({ body: ['contact_name', 'business_name', 'message'] }, 3, {
      contact_name: '', business_name: 'The  Olive\nTree', message: 'Line one\n\nLine two',
    })
    expect(vals).toEqual(['there', 'The Olive Tree', 'Line one Line two'])
  })

  it('uses the whole message for variables with no mapping (old behaviour)', () => {
    expect(paramsFor({ body: [] }, 1, { message: 'Hi' })).toEqual(['Hi'])
  })
})

describe('renderTemplate', () => {
  it('shows the text the lead receives', () => {
    const { draft } = draftFromMessage('Hi {contact_name}, a quick idea for {business_name}.', 'a')
    const text = renderTemplate(toComponents({ ...draft, footer: 'Reply STOP to opt out' }), ['Sam', 'Bloom Cafe'])
    expect(text).toBe('Hi Sam, a quick idea for Bloom Cafe.\n\nReply STOP to opt out')
  })
})
