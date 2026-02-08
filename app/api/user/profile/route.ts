import { NextRequest, NextResponse } from "next/server"
import { getAuthUser, getPrivyUser, extractPrivyUserInfo } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const privyAuth = await getAuthUser()

    if (!privyAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find user in database by Privy ID
    const user = await prisma.user.findUnique({
      where: { privyId: privyAuth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        walletAddress: true,
        evmWalletAddress: true,
        createdAt: true,
      },
    })

    if (!user) {
      // User authenticated with Privy but not in our DB yet
      return NextResponse.json({
        privyId: privyAuth.userId,
        role: null,
        needsOnboarding: true,
      })
    }

    // Get wallet addresses from Privy (linked accounts)
    let wallets: { address: string; chain: string }[] = []
    try {
      const privyUser = await getPrivyUser(privyAuth.userId)
      if (privyUser) {
        const info = extractPrivyUserInfo(privyUser)
        wallets = info.wallets

        // Update DB email if it was a placeholder
        if (user.email.includes('@privy.io') && info.email) {
          await prisma.user.update({
            where: { id: user.id },
            data: { email: info.email },
          }).catch(() => {}) // Don't fail the request if email update fails (unique constraint)
        }

        // Sync wallet addresses from Privy (always update if Privy has them)
        const walletUpdates: Record<string, string> = {}
        if (info.solanaWallet?.address && user.walletAddress !== info.solanaWallet.address) {
          walletUpdates.walletAddress = info.solanaWallet.address
        }
        const evmWallet = info.wallets.find(w => w.chain === 'ethereum')
        if (evmWallet?.address && user.evmWalletAddress !== evmWallet.address) {
          walletUpdates.evmWalletAddress = evmWallet.address
        }
        if (Object.keys(walletUpdates).length > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: walletUpdates,
          }).catch(() => {})
        }
      }
    } catch (e) {
      // Non-critical — just return what we have
    }

    return NextResponse.json({
      ...user,
      wallets,
    })
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const privyAuth = await getAuthUser()

    if (!privyAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    const user = await prisma.user.findUnique({
      where: { privyId: privyAuth.userId },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        walletAddress: true,
        evmWalletAddress: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
