import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent, requireAgentStatus } from "@/lib/api-auth"
import { getAuthUser } from "@/lib/auth"
import { AgentStatus, ApplicationStatus, TaskStatus } from "@prisma/client"
import { createSystemMessage } from "@/lib/messages"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const body = await request.json().catch(() => ({}))
    const coverMessage = body.message?.trim() || null

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

      // Check agent status — skip for human-managed agents (they get ACTIVE on creation)
      if (!agent.operatorId) {
        const statusCheck = await requireAgentStatus(agent, AgentStatus.VERIFIED_CAPABILITY)
        if (!statusCheck.authorized) {
          return NextResponse.json(
            { error: statusCheck.error },
            { status: 403 }
          )
        }
      }
    } else {
      // Try Privy auth — find or create agent for this user
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

      // Find existing agent for this user, or auto-create one
      agent = await prisma.agent.findFirst({
        where: { operatorId: user.id },
      })

      if (!agent) {
        // Auto-create an agent profile for this human user
        agent = await prisma.agent.create({
          data: {
            name: user.name || user.email.split("@")[0],
            operatorId: user.id,
            capabilities: ["general"],
            status: AgentStatus.ACTIVE, // Human users don't need trial
            walletAddress: user.walletAddress,
          },
        })
      }
    }

    // Find the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      )
    }

    // Check if task is active
    if (task.status !== TaskStatus.ACTIVE) {
      return NextResponse.json(
        { error: "Task is not accepting applications" },
        { status: 400 }
      )
    }

    // Check if task has slots available
    if (task.currentWorkers >= task.maxWorkers) {
      return NextResponse.json(
        { error: "Task is full" },
        { status: 400 }
      )
    }

    // Check if agent has already applied
    const existingApplication = await prisma.application.findFirst({
      where: { taskId: task.id, agentId: agent.id },
    })

    if (existingApplication) {
      return NextResponse.json(
        {
          error: "You have already applied to this task",
          application: {
            id: existingApplication.id,
            status: existingApplication.status,
          },
        },
        { status: 400 }
      )
    }

    // Create application (auto-accepted for now)
    const application = await prisma.application.create({
      data: {
        taskId: task.id,
        agentId: agent.id,
        status: ApplicationStatus.ACCEPTED,
        acceptedAt: new Date(),
        message: coverMessage,
      },
    })

    // Increment currentWorkers count
    await prisma.task.update({
      where: { id: task.id },
      data: { currentWorkers: { increment: 1 } },
    })

    // Create system message in the task conversation
    await createSystemMessage(
      task.id,
      `${agent.name} was accepted and assigned to this task.`
    ).catch(() => {}) // Non-critical

    // Notify task creator of new application
    createNotification(
      task.creator.id,
      "APPLICATION_RECEIVED",
      "New application received",
      `${agent.name} applied to "${task.title}"`,
      `/tasks/${task.id}/submissions`
    ).catch(() => {}) // Non-critical

    // Return task details
    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        status: application.status,
        message: application.message,
        appliedAt: application.appliedAt,
        acceptedAt: application.acceptedAt,
      },
      taskDetails: {
        id: task.id,
        title: task.title,
        description: task.description,
        referenceUrl: task.referenceUrl,
        credentials: task.credentials,
        requirements: task.requirements,
        category: task.category,
        payment: task.paymentPerWorker,
        deadline: task.deadline,
      },
      message: "Application accepted! You can now start working on the task.",
    })
  } catch (error) {
    console.error("Apply to task error:", error)
    return NextResponse.json(
      { error: "Failed to apply to task. Please try again." },
      { status: 500 }
    )
  }
}
