import { redirect } from "next/navigation"
import { getAuthUser, getPrivyUser, extractPrivyUserInfo } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type UserRole = 'CREATOR' | 'AGENT_OPERATOR' | 'ADMIN'

/**
 * @deprecated Use requireAuth() instead — roles are no longer enforced per-page.
 */
export async function requireRole(role: UserRole | UserRole[]) {
  return requireAuth()
}

export async function getSession() {
  const privyUser = await getAuthUser()

  if (!privyUser) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { privyId: privyUser.userId },
  })

  if (!user) {
    return null
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
      evmWalletAddress: user.evmWalletAddress,
    },
  }
}

export async function requireAuth() {
  const privyAuth = await getAuthUser()

  if (!privyAuth) {
    redirect('/')
  }

  let user = await prisma.user.findUnique({
    where: { privyId: privyAuth.userId },
  })

  // Auto-create user on first visit (no onboarding needed)
  if (!user) {
    let privyEmail: string | null = null
    let solanaAddress: string | null = null
    let evmAddress: string | null = null

    // 1. Get user info from Privy
    try {
      const privyUser = await getPrivyUser(privyAuth.userId)
      if (privyUser) {
        const info = extractPrivyUserInfo(privyUser)
        privyEmail = info.email
        solanaAddress = info.solanaWallet?.address ?? null
        evmAddress = info.wallets.find(w => w.chain === 'ethereum')?.address ?? null
      }
    } catch (e) {
      // Non-critical
    }

    const email = privyEmail ?? `${privyAuth.userId.replace('did:privy:', '')}@privy.io`

    try {
      user = await prisma.user.create({
        data: {
          privyId: privyAuth.userId,
          email,
          walletAddress: solanaAddress,
          evmWalletAddress: evmAddress,
        },
      })
    } catch (e: any) {
      // Email uniqueness conflict — try finding by email
      if (e?.code === 'P2002') {
        user = await prisma.user.findUnique({ where: { email } })
        if (user && !user.privyId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { privyId: privyAuth.userId },
          })
        }
      }
      if (!user) throw e
    }
  }

  // Sync wallets if user exists but is missing wallet addresses
  if (user && (!user.walletAddress || !user.evmWalletAddress)) {
    try {
      const privyUser = await getPrivyUser(privyAuth.userId)
      if (privyUser) {
        const info = extractPrivyUserInfo(privyUser)
        const updates: Record<string, string> = {}
        if (!user.walletAddress && info.solanaWallet?.address) {
          updates.walletAddress = info.solanaWallet.address
        }
        const evmW = info.wallets.find(w => w.chain === 'ethereum')
        if (!user.evmWalletAddress && evmW?.address) {
          updates.evmWalletAddress = evmW.address
        }
        if (Object.keys(updates).length > 0) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: updates,
          }) as any
        }
      }
    } catch (e) {
      // Non-critical
    }
  }

  if (!user) {
    redirect('/')
  }

  return {
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      role: user!.role,
      walletAddress: user!.walletAddress,
      evmWalletAddress: user!.evmWalletAddress,
    },
  }
}
