import { NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  // For /api/admin/* routes: verify privy-token cookie exists
  const privyToken = request.cookies.get("privy-token")
  if (!privyToken) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  // Cookie exists — let the request through to the route handler for full role verification
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/admin/:path*"],
}
