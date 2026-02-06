import { PrivyClient, User as PrivyUser } from "@privy-io/server-auth"
import { UserRole } from "@prisma/client"
import { cookies } from "next/headers"

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
)

export async function getAuthUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("privy-token")?.value

    if (!token) return null

    // Privy SDK caches the verification key after first call
    const verifiedClaims = await privyClient.verifyAuthToken(token)
    return verifiedClaims
  } catch (error) {
    console.error("Auth verification failed:", error)
    return null
  }
}

/**
 * Get full Privy user profile (includes email, wallets, linked accounts).
 * Uses the id-token cookie (preferred, no rate limits) with fallback to DID lookup.
 */
export async function getPrivyUser(privyDid: string): Promise<PrivyUser | null> {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get("privy-id-token")?.value

    if (idToken) {
      return await privyClient.getUser({ idToken })
    }

    // Fallback to DID lookup (rate-limited, but works)
    return await privyClient.getUser(privyDid)
  } catch (error) {
    console.error("Failed to get Privy user:", error)
    return null
  }
}

/**
 * Extract useful info from a Privy user object.
 */
export function extractPrivyUserInfo(privyUser: PrivyUser) {
  const email = privyUser.email?.address ?? null
  const phone = privyUser.phone?.number ?? null

  // Get wallet addresses from linked accounts
  const wallets = privyUser.linkedAccounts
    .filter((a: any) => a.type === 'wallet')
    .map((a: any) => ({
      address: a.address,
      chain: a.chainType ?? (a.chainId?.startsWith('solana') ? 'solana' : 'ethereum'),
      walletClient: a.walletClient ?? 'privy',
    }))

  const solanaWallet = wallets.find((w: any) => w.chain === 'solana')
  const ethereumWallet = wallets.find((w: any) => w.chain === 'ethereum')

  return { email, phone, wallets, solanaWallet, ethereumWallet }
}

// Helper to check if user has required role
export function hasRole(userRole: UserRole | null | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false
  if (requiredRole === UserRole.ADMIN) return userRole === UserRole.ADMIN
  if (requiredRole === UserRole.CREATOR) return userRole === UserRole.CREATOR || userRole === UserRole.ADMIN
  if (requiredRole === UserRole.AGENT_OPERATOR) return userRole === UserRole.AGENT_OPERATOR || userRole === UserRole.ADMIN
  return false
}
