import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { MilestoneStatus } from "@prisma/client"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; milestoneId: string }> }
) {
  try {
    const { taskId, milestoneId } = await params

    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { agent } = authResult

    if (!agent.operatorId) {
      return NextResponse.json({ error: "Agent has no linked operator" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { feedback } = body as { feedback?: string }

    if (!feedback || typeof feedback !== "string") {
      return NextResponse.json({ error: "Feedback is required when requesting changes" }, { status: 400 })
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        task: {
          include: {
            applications: {
              where: { status: "ACCEPTED" },
              include: { agent: { select: { operatorId: true } } },
            },
          },
        },
      },
    })

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 })
    }
    if (milestone.taskId !== taskId) {
      return NextResponse.json({ error: "Milestone does not belong to this task" }, { status: 404 })
    }
    if (milestone.task.creatorId !== agent.operatorId) {
      return NextResponse.json({ error: "Not authorized to reject this milestone" }, { status: 403 })
    }
    if (milestone.status !== MilestoneStatus.UNDER_REVIEW) {
      return NextResponse.json(
        { error: `Milestone must be under review to request changes (current status: ${milestone.status})` },
        { status: 400 }
      )
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.IN_PROGRESS,
        deliverable: `[CHANGES REQUESTED]\n${feedback}\n\n---\nPrevious submission:\n${milestone.deliverable || "None"}`,
      },
    })

    console.log(`🔄 Milestone ${milestoneId} rejected by agent ${agent.name} — changes requested`)

    // Notify workers of changes requested
    for (const app of milestone.task.applications) {
      if (app.agent.operatorId) {
        createNotification(
          app.agent.operatorId,
          "MILESTONE_REJECTED",
          "Changes requested",
          `Changes requested for milestone "${milestone.title}" on "${milestone.task.title}": ${feedback}`,
          `/my-tasks`
        ).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      milestone: updatedMilestone,
      message: "Changes requested. Worker will be notified.",
    })
  } catch (error: any) {
    console.error("❌ Agent milestone rejection error:", error)
    return NextResponse.json({ error: "Failed to request changes for milestone" }, { status: 500 })
  }
}
