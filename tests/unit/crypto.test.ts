import { describe, it, expect } from 'vitest'
import {
  encryptValue,
  decryptValue,
  isEncrypted,
  isSensitiveKey,
  encryptIntegrationConfig,
  decryptIntegrationConfig,
} from '@/lib/crypto'

describe('AES-256-GCM Encryption for Integration Credentials', () => {
  it('encrypts plaintext into enc:v1 format and decrypts it back accurately', () => {
    const secret = 'EAAOx9281739102837465'
    const encrypted = encryptValue(secret)

    expect(isEncrypted(encrypted)).toBe(true)
    expect(encrypted.startsWith('enc:v1:')).toBe(true)
    expect(encrypted).not.toBe(secret)

    const decrypted = decryptValue(encrypted)
    expect(decrypted).toBe(secret)
  })

  it('does not re-encrypt already encrypted values', () => {
    const secret = 'my-token'
    const enc1 = encryptValue(secret)
    const enc2 = encryptValue(enc1)
    expect(enc2).toBe(enc1)
  })

  it('returns empty string if ciphertext is corrupted or tampered with', () => {
    const secret = 'super-secret'
    const encrypted = encryptValue(secret)
    // Tamper with the ciphertext payload
    const corrupted = encrypted.slice(0, -4) + 'abcd'
    const decrypted = decryptValue(corrupted)
    expect(decrypted).toBe('')
  })

  it('correctly identifies sensitive keys', () => {
    expect(isSensitiveKey('access_token')).toBe(true)
    expect(isSensitiveKey('resend_api_key')).toBe(true)
    expect(isSensitiveKey('client_secret')).toBe(true)
    expect(isSensitiveKey('smtp_pass')).toBe(true)
    expect(isSensitiveKey('app_secret')).toBe(true)

    expect(isSensitiveKey('phone_number_id')).toBe(false)
    expect(isSensitiveKey('waba_id')).toBe(false)
    expect(isSensitiveKey('from_email')).toBe(false)
    expect(isSensitiveKey('from_name')).toBe(false)
    expect(isSensitiveKey('username')).toBe(false)
  })

  it('encrypts only sensitive fields in a full integration config object', () => {
    const rawConfig = {
      phone_number_id: '491823901238491',
      waba_id: '109283746591023',
      access_token: 'EAAG9...k921m',
      from_name: 'Selfera Sales Team',
      resend_api_key: 're_9xK8...21mP',
    }

    const encryptedConfig = encryptIntegrationConfig(rawConfig)

    // Non-sensitive fields stay as-is
    expect(encryptedConfig.phone_number_id).toBe('491823901238491')
    expect(encryptedConfig.waba_id).toBe('109283746591023')
    expect(encryptedConfig.from_name).toBe('Selfera Sales Team')

    // Sensitive fields are encrypted
    expect(isEncrypted(encryptedConfig.access_token)).toBe(true)
    expect(isEncrypted(encryptedConfig.resend_api_key)).toBe(true)

    // Decrypting returns the original values
    const decryptedConfig = decryptIntegrationConfig(encryptedConfig)
    expect(decryptedConfig).toEqual(rawConfig)
  })
})

