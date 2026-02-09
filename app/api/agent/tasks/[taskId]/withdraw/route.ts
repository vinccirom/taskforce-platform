import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgentOrUser } from "@/lib/api-auth"
import { createSystemMessage } from "@/lib/messages"

/**
 * POST /api/agent/tasks/[taskId]/withdraw
 * 
 * Safety rules:
 * - PENDING application: hard delete (never started)
 * - ACCEPTED with no submission: withdraw (delete app, decrement workers)
 * - ACCEPTED/PAID/COMPLETED with submission: BLOCKED
 * - Task IN_PROGRESS/COMPLETED/DISPUTED: BLOCKED
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    const authResult = await authenticateAgentOrUser(request)
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { agent } = authResult

    // Find the application
    const application = await prisma.application.findFirst({
      where: { taskId, agentId: agent.id },
      include: {
        submission: true,
        task: {
          select: { id: true, title: true, status: true, currentWorkers: true },
        },
      },
    })

    if (!application) {
      return NextResponse.json({ error: "No application found for this task" }, { status: 404 })
    }

    // --- Safety checks ---

    // Can't withdraw if there's a submission
    if (application.submission) {
      return NextResponse.json(
        { error: "Cannot withdraw — you have already submitted work for this task. Contact the creator if you need to resolve this." },
        { status: 400 }
      )
    }

    // Can't withdraw from completed/paid applications
    if (application.status === "COMPLETED" || application.status === "PAID") {
      return NextResponse.json(
        { error: `Cannot withdraw — application is already ${application.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    // Can't withdraw if task is in a terminal/disputed state
    if (application.task.status === "COMPLETED" || application.task.status === "DISPUTED") {
      return NextResponse.json(
        { error: `Cannot withdraw — task is ${application.task.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    // --- Withdraw ---

    const wasAccepted = application.status === "ACCEPTED"

    // Delete the application
    await prisma.application.delete({ where: { id: application.id } })

    // If they were accepted, decrement the worker count
    if (wasAccepted && application.task.currentWorkers > 0) {
      await prisma.task.update({
        where: { id: taskId },
        data: { currentWorkers: { decrement: 1 } },
      })
    }

    // System message
    await createSystemMessage(
      taskId,
      `${agent.name} withdrew from this task.`
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      message: "Application withdrawn successfully.",
      taskTitle: application.task.title,
    })
  } catch (error: any) {
    console.error("❌ Application withdraw error:", error)
    return NextResponse.json({ error: "Failed to withdraw application" }, { status: 500 })
  }
}
