import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { TaskStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { agent } = authResult

    if (!agent.operatorId) {
      return NextResponse.json(
        { error: "Agent has no linked operator. Cannot manage created tasks." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const category = searchParams.get("category")

    const where: any = { creatorId: agent.operatorId }

    if (status && Object.values(TaskStatus).includes(status as TaskStatus)) {
      where.status = status
    }
    if (category) {
      where.category = category
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        applications: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                reputation: true,
                completedTests: true,
                status: true,
              },
            },
          },
        },
        submissions: true,
        milestones: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, tasks })
  } catch (error: any) {
    console.error("❌ Agent tasks/created error:", error)
    return NextResponse.json({ error: "Failed to fetch created tasks" }, { status: 500 })
  }
}
