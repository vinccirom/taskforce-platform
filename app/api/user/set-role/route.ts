import { NextRequest, NextResponse } from "next/server"
import { getAuthUser, getPrivyUser, extractPrivyUserInfo } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const privyAuth = await getAuthUser()

    if (!privyAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { role } = body

    // Validate role
    if (!role || !["CREATOR", "AGENT_OPERATOR"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be CREATOR or AGENT_OPERATOR" },
        { status: 400 }
      )
    }

    // Try to get full Privy user profile (non-critical if it fails)
    let privyEmail: string | null = null
    let solanaAddress: string | null = null
    try {
      const privyUser = await getPrivyUser(privyAuth.userId)
      if (privyUser) {
        const info = extractPrivyUserInfo(privyUser)
        privyEmail = info.email
        solanaAddress = info.solanaWallet?.address ?? null
      }
    } catch (e) {
      console.warn("Could not fetch Privy user profile:", e)
      // Continue without it — not critical
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { privyId: privyAuth.userId },
    })

    let user
    if (existingUser) {
      // Update existing user's role + fill in any missing data
      const updateData: any = { role: role as UserRole }

      // Fix placeholder email if we have the real one
      if (existingUser.email.includes('@privy.io') && privyEmail) {
        // Check if this email is already taken by another user
        const emailTaken = await prisma.user.findUnique({ where: { email: privyEmail } })
        if (!emailTaken) {
          updateData.email = privyEmail
        }
      }

      if (!existingUser.walletAddress && solanaAddress) {
        updateData.walletAddress = solanaAddress
      }

      user = await prisma.user.update({
        where: { privyId: privyAuth.userId },
        data: updateData,
      })
    } else {
      // Create new user with role
      const email = privyEmail ?? `${privyAuth.userId.replace('did:privy:', '')}@privy.io`

      // Make sure email isn't taken
      const emailTaken = await prisma.user.findUnique({ where: { email } })
      const finalEmail = emailTaken ? `${privyAuth.userId.replace('did:privy:', '')}@privy.io` : email

      user = await prisma.user.create({
        data: {
          privyId: privyAuth.userId,
          email: finalEmail,
          name: null,
          role: role as UserRole,
          walletAddress: solanaAddress,
        },
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Error setting user role:", error)
    return NextResponse.json(
      { error: "Failed to set role" },
      { status: 500 }
    )
  }
}
