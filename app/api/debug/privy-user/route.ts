import { NextResponse } from "next/server"
import { getAuthUser, getPrivyUser } from "@/lib/auth"

export async function GET() {
  try {
    const auth = await getAuthUser()
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const privyUser = await getPrivyUser(auth.userId)
    if (!privyUser) return NextResponse.json({ error: "Privy user not found" })

    // Return the raw linked accounts so we can see what Privy sends
    return NextResponse.json({
      userId: auth.userId,
      email: privyUser.email,
      phone: privyUser.phone,
      linkedAccounts: privyUser.linkedAccounts.map((a: any) => ({
        type: a.type,
        address: a.address,
        chainType: a.chainType,
        chainId: a.chainId,
        walletClient: a.walletClient,
        walletClientType: a.walletClientType,
        connectorType: a.connectorType,
        // include all keys for debugging
        ...Object.fromEntries(
          Object.entries(a).filter(([k]) => !['verifiedAt', 'firstVerifiedAt', 'latestVerifiedAt'].includes(k))
        ),
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
