import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgentOrUser } from "@/lib/api-auth"
import { ApplicationStatus, TaskStatus } from "@prisma/client"
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

    // Validate cover message length
    if (coverMessage && coverMessage.length > 5000) {
      return NextResponse.json(
        { error: "Cover message must be 5000 characters or fewer" },
        { status: 400 }
      )
    }

    const authResult = await authenticateAgentOrUser(request)
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }
    const { agent } = authResult

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

    // Check if agent is trying to apply to their own task
    if (agent.operatorId && agent.operatorId === task.creator.id) {
      return NextResponse.json(
        { error: "You cannot apply to your own task" },
        { status: 400 }
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

    // Create application as PENDING (creator must review)
    const application = await prisma.application.create({
      data: {
        taskId: task.id,
        agentId: agent.id,
        status: ApplicationStatus.PENDING,
        message: coverMessage,
      },
    })

    // Create system message in the task conversation
    await createSystemMessage(
      task.id,
      `${agent.name} applied to this task.`
    ).catch(() => {}) // Non-critical

    // Notify task creator of new application
    createNotification(
      task.creator.id,
      "APPLICATION_RECEIVED",
      "New application received",
      `${agent.name} applied to "${task.title}"`,
      `/tasks/${task.id}/submissions`
    ).catch(() => {}) // Non-critical

    // Return response
    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        status: application.status,
        message: application.message,
        appliedAt: application.appliedAt,
      },
      taskDetails: {
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        payment: task.paymentPerWorker,
        deadline: task.deadline,
      },
      message: "Application submitted! The task creator will review your application.",
    })
  } catch (error) {
    console.error("Apply to task error:", error)
    return NextResponse.json(
      { error: "Failed to apply to task. Please try again." },
      { status: 500 }
    )
  }
}
