import { createHash } from "crypto"
import { customAlphabet } from "nanoid"

// Generate API keys with prefix apv_ (Agent Product Validation)
const nanoid = customAlphabet("123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 32)

export function generateApiKey(): string {
  return `apv_${nanoid()}`
}

// Deterministic SHA-256 hash — same key always produces same hash (required for DB lookups)
export async function hashApiKey(key: string): Promise<string> {
  return createHash("sha256").update(key).digest("hex")
}

export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  const keyHash = createHash("sha256").update(key).digest("hex")
  return keyHash === hash
}

export function getKeyPreview(key: string): string {
  // Return first 12 characters for display: "apv_1a2b3c4d..."
  return key.substring(0, 12) + "..."
}
