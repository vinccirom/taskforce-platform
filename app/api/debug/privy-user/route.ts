import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { PrivyClient } from "@privy-io/server-auth"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const auth = await getAuthUser()
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    // Try both SDK approaches
    const results: any = {
      authUserId: auth.userId,
      envCheck: {
        hasAppId: !!process.env.NEXT_PUBLIC_PRIVY_APP_ID,
        hasSecret: !!process.env.PRIVY_APP_SECRET,
        appIdPrefix: process.env.NEXT_PUBLIC_PRIVY_APP_ID?.substring(0, 8),
      },
    }

    // Approach 1: server-auth SDK
    try {
      const client = new PrivyClient(
        process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        process.env.PRIVY_APP_SECRET!
      )
      
      // Try with idToken first
      const cookieStore = await cookies()
      const idToken = cookieStore.get("privy-id-token")?.value
      
      if (idToken) {
        try {
          const user = await client.getUser({ idToken })
          results.serverAuth = {
            method: "idToken",
            userId: user.id,
            email: user.email,
            linkedAccountTypes: user.linkedAccounts?.map((a: any) => ({
              type: a.type,
              chainType: a.chainType,
              chainId: a.chainId,
              address: a.address,
              walletClient: a.walletClient,
              walletClientType: a.walletClientType,
            })),
          }
          return NextResponse.json(results)
        } catch (e: any) {
          results.idTokenError = e.message
        }
      } else {
        results.idToken = "not found in cookies"
      }

      // Fallback: DID lookup
      try {
        const user = await client.getUser(auth.userId)
        results.serverAuth = {
          method: "did",
          userId: user.id,
          email: user.email,
          linkedAccountTypes: user.linkedAccounts?.map((a: any) => ({
            type: a.type,
            chainType: a.chainType,
            chainId: a.chainId,
            address: a.address,
            walletClient: a.walletClient,
            walletClientType: a.walletClientType,
          })),
        }
      } catch (e: any) {
        results.didError = e.message
      }
    } catch (e: any) {
      results.serverAuthInitError = e.message
    }

    return NextResponse.json(results)
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.split('\n').slice(0, 5) }, { status: 500 })
  }
}
