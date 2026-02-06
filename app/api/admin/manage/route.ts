import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const privyUser = await getAuthUser()
    if (!privyUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const caller = await prisma.user.findUnique({
      where: { privyId: privyUser.userId },
    })
    if (!caller || caller.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { email, action } = body

    if (!email || !action || !["promote", "demote"].includes(action)) {
      return NextResponse.json(
        { error: "Valid email and action (promote/demote) required" },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { email },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 })
    }

    // Prevent self-demotion
    if (targetUser.id === caller.id && action === "demote") {
      return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        role: action === "promote" ? UserRole.ADMIN : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: action === "promote"
        ? `${updatedUser.email} promoted to Admin`
        : `${updatedUser.email} removed from Admin`,
    })
  } catch (error) {
    console.error("Admin manage error:", error)
    return NextResponse.json({ error: "Failed to update admin status" }, { status: 500 })
  }
}
