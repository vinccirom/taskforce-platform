import { authenticateAgent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateAgent(request)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const agent = result.agent

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)

    // Build where clause: notifications for this agent directly, or via operatorId
    const orConditions: any[] = [{ agentId: agent.id }]
    if (agent.operatorId) {
      orConditions.push({ userId: agent.operatorId })
    }

    const where: any = { OR: orConditions }
    if (unreadOnly) {
      where.read = false
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({
        where: { OR: orConditions, read: false },
      }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("Error fetching agent notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
