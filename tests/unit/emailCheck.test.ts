import { describe, expect, it } from 'vitest'
import { basicEmailCheck, typoSuggestion } from '@/lib/emailCheck'

describe('basicEmailCheck', () => {
  it('rejects badly written emails', () => {
    for (const e of ['john@', 'john@gmail', 'john gmail.com', 'jo hn@gmail.com', '@gmail.com', 'john@@gmail.com']) {
      expect(basicEmailCheck(e).status).toBe('invalid')
    }
  })

  it('leaves good-looking emails for the network checks', () => {
    const c = basicEmailCheck('  Priya.Shah@Gmail.com ')
    expect(c).toEqual({ status: null, reason: null, suggestion: null, role: false })
  })

  it('marks throwaway services', () => {
    expect(basicEmailCheck('abc@mailinator.com').status).toBe('disposable')
  })

  it('flags shared inboxes', () => {
    expect(basicEmailCheck('info@theolivetree.co.uk').role).toBe(true)
    expect(basicEmailCheck('sarah@theolivetree.co.uk').role).toBe(false)
  })

  it('suggests a fix for common typos', () => {
    expect(basicEmailCheck('sam@gmial.com').suggestion).toBe('sam@gmail.com')
    expect(basicEmailCheck('sam@hotmail.co.uj').suggestion).toBe('sam@hotmail.co.uk')
  })
})

describe('typoSuggestion', () => {
  it('fixes common domains and endings, and leaves real business domains alone', () => {
    expect(typoSuggestion('yaho.co.uk')).toBe('yahoo.co.uk')
    expect(typoSuggestion('outlook.con')).toBe('outlook.com')
    expect(typoSuggestion('gmail.com')).toBeNull()
    expect(typoSuggestion('theolivetree.co.uk')).toBeNull()
    expect(typoSuggestion('selfera.co.uk')).toBeNull()
  })
})
