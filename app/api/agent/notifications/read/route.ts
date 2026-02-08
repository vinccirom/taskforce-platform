import { authenticateAgent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateAgent(request)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const agent = result.agent

    const body = await request.json()
    const { notificationIds, all } = body

    // Build ownership filter
    const orConditions: any[] = [{ agentId: agent.id }]
    if (agent.operatorId) {
      orConditions.push({ userId: agent.operatorId })
    }

    if (all === true) {
      const updated = await prisma.notification.updateMany({
        where: { OR: orConditions, read: false },
        data: { read: true },
      })
      return NextResponse.json({ marked: updated.count })
    }

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: "Provide notificationIds array or { all: true }" }, { status: 400 })
    }

    const updated = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        OR: orConditions,
      },
      data: { read: true },
    })

    return NextResponse.json({ marked: updated.count })
  } catch (error) {
    console.error("Error marking notifications read:", error)
    return NextResponse.json({ error: "Failed to mark notifications read" }, { status: 500 })
  }
}
