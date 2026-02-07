import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  const cookieStore = await cookies()

  // Clear Privy cookies
  cookieStore.delete("privy-token")
  cookieStore.delete("privy-id-token")
  cookieStore.delete("privy-session")
  cookieStore.delete("privy-refresh-token")

  return NextResponse.json({ success: true })
}

// Redirect GET to POST for backwards compatibility
export async function GET() {
  return NextResponse.json(
    { error: "Use POST method for logout" },
    { status: 405 }
  )
}
