import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_BYTES = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, KEY_BYTES)
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, saltText, keyText, extra] = encoded.split('$')
  if (algorithm !== 'scrypt' || !saltText || !keyText || extra) return false
  try {
    const expected = Buffer.from(keyText, 'base64url')
    const actual = scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length)
    return expected.length === KEY_BYTES && timingSafeEqual(actual, expected)
  } catch { return false }
}

export function normalizeAccountName(name: string): string {
  return name.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}

export function validateAuthenticationInput(name: string, password: string): string | null {
  const normalized = normalizeAccountName(name)
  if (normalized.length < 2 || normalized.length > 48) return 'Name must contain 2–48 characters.'
  if (password.length < 10 || password.length > 256) return 'Password must contain 10–256 characters.'
  return null
}
