import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  
  // Clear Privy cookies
  cookieStore.delete("privy-token")
  cookieStore.delete("privy-id-token")
  cookieStore.delete("privy-session")
  cookieStore.delete("privy-refresh-token")
  
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
}
