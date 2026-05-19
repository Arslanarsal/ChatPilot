import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'


const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IV_LEN = 12

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not defined — required for message encryption',
    )
  }

  cachedKey = createHash('sha256').update(secret).digest()
  return cachedKey
}

export function encryptMessage(plain: string | null | undefined): string {
  if (plain == null || plain === '') return plain as string
  
  if (typeof plain === 'string' && plain.startsWith(PREFIX)) return plain

  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
}

export function decryptMessage(stored: string | null | undefined): string {
  if (stored == null || stored === '') return stored as string
 
  if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) return stored as string

  const body = stored.slice(PREFIX.length)
  const [ivB64, tagB64, ctB64] = body.split(':')
  if (!ivB64 || !tagB64 || !ctB64) {
    // Malformed — return raw value rather than crashing the request.
    return stored
  }
  try {
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(tagB64, 'base64')
    const ciphertext = Buffer.from(ctB64, 'base64')
    const decipher = createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(authTag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plain.toString('utf8')
  } catch {
    
    return stored
  }
}

export function decryptMessagesInPlace<T extends { message?: string | null }>(
  rows: T[],
): T[] {
  for (const row of rows) {
    if (row.message != null) {
      row.message = decryptMessage(row.message)
    }
  }
  return rows
}
