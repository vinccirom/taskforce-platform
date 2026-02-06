import bcrypt from "bcryptjs"
import { customAlphabet } from "nanoid"

// Generate API keys with prefix apv_ (Agent Product Validation)
const nanoid = customAlphabet("123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 32)

export function generateApiKey(): string {
  return `apv_${nanoid()}`
}

export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10)
}

export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash)
}

export function getKeyPreview(key: string): string {
  // Return first 12 characters for display: "apv_1a2b3c4d..."
  return key.substring(0, 12) + "..."
}
