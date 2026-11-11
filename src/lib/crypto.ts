import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1'

/**
 * Returns a 32-byte key derived from INTEGRATIONS_ENCRYPTION_KEY or system master secret
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (envKey) {
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, 'hex')
    }
    if (envKey.length === 32) {
      return Buffer.from(envKey, 'utf8')
    }
  }

  // Fallback: derive deterministically from available secret
  const fallbackSecret =
    process.env.INTEGRATIONS_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.JWT_ACCESS_SECRET ||
    'selfera-sales-master-secret-2026'

  return crypto.createHash('sha256').update(fallbackSecret).digest()
}

/**
 * Check if a value is already encrypted with our format
 */
export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`)
}

/**
 * Encrypt a plaintext string using AES-256-GCM with random IV and authenticated tag
 */
export function encryptValue(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string' || isEncrypted(plaintext)) {
    return plaintext
  }

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(12) // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag() // 128-bit authentication tag

    return `${PREFIX}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
  } catch (err) {
    console.error('[crypto] Encryption error:', err)
    return plaintext
  }
}

/**
 * Decrypt an AES-256-GCM ciphertext string back to plaintext
 */
export function decryptValue(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string' || !isEncrypted(ciphertext)) {
    return ciphertext
  }

  try {
    const parts = ciphertext.split(':')
    if (parts.length !== 5) return ciphertext

    const [, , ivHex, tagHex, dataHex] = parts
    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const encryptedData = Buffer.from(dataHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
    return decrypted.toString('utf8')
  } catch (err: any) {
    console.warn('[crypto] Decryption failed (tampered data or wrong key):', err?.message)
    return ''
  }
}

/**
 * Identify if a config property key holds sensitive data (tokens, secrets, passwords, api keys)
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (lower.includes('public') || lower.includes('url') || lower.includes('phone') || lower.includes('id') || lower.includes('name') || lower.includes('port') || lower.includes('host') || lower.includes('user')) {
    // Specifically allow api_key, access_token, app_secret, waba_id is not secret, client_secret is secret
    if (lower.includes('key') || lower.includes('secret') || lower.includes('token') || lower.includes('pass')) {
      return true
    }
    return false
  }

  return /token|secret|key|pass|credential|auth/i.test(lower)
}

/**
 * Encrypt all sensitive fields in a channel configuration record
 */
export function encryptIntegrationConfig(config: Record<string, any>): Record<string, any> {
  if (!config || typeof config !== 'object') return config

  const result: Record<string, any> = { ...config }
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'string' && isSensitiveKey(k) && v.trim().length > 0) {
      result[k] = encryptValue(v)
    }
  }
  return result
}

/**
 * Decrypt all encrypted fields in a channel configuration record
 */
export function decryptIntegrationConfig(config: Record<string, any>): Record<string, any> {
  if (!config || typeof config !== 'object') return config

  const result: Record<string, any> = { ...config }
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'string' && isEncrypted(v)) {
      result[k] = decryptValue(v)
    }
  }
  return result
}

