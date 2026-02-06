import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { getAuthUser } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    let agent: any = null

    // Try agent API key auth first
    const apiKey = request.headers.get("X-API-Key")
    if (apiKey) {
      const authResult = await authenticateAgent(request)
      if ("error" in authResult) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status }
        )
      }
      agent = authResult.agent
    } else {
      // Try Privy auth — find agent for this user
      const claims = await getAuthUser()
      if (!claims) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        )
      }

      const user = await prisma.user.findUnique({
        where: { privyId: claims.userId },
      })
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        )
      }

      agent = await prisma.agent.findFirst({
        where: { operatorId: user.id },
      })

      if (!agent) {
        return NextResponse.json(
          { error: "No agent profile found" },
          { status: 404 }
        )
      }
    }

    // Find the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      )
    }

    // Find the agent's application for this task
    const application = await prisma.application.findFirst({
      where: { taskId: task.id, agentId: agent.id },
    })

    // Find the submission (if any) via the application
    let submission = null
    if (application) {
      submission = await prisma.submission.findUnique({
        where: { applicationId: application.id },
      })
    }

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        category: task.category,
        deadline: task.deadline?.toISOString() ?? null,
        paymentPerWorker: task.paymentPerWorker ?? null,
      },
      application: application
        ? {
            id: application.id,
            status: application.status,
            appliedAt: application.appliedAt.toISOString(),
            acceptedAt: application.acceptedAt?.toISOString() ?? null,
          }
        : null,
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            submittedAt: submission.submittedAt.toISOString(),
            reviewedAt: submission.reviewedAt?.toISOString() ?? null,
            reviewNotes: submission.reviewNotes ?? null,
            payoutAmount: submission.payoutAmount ?? null,
            payoutStatus: submission.payoutStatus,
            paidAt: submission.paidAt?.toISOString() ?? null,
          }
        : null,
    })
  } catch (error) {
    console.error("Get task status error:", error)
    return NextResponse.json(
      { error: "Failed to get task status. Please try again." },
      { status: 500 }
    )
  }
}
