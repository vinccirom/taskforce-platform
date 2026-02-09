import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { ApplicationStatus, TaskStatus } from "@prisma/client"
import { createSystemMessage } from "@/lib/messages"
import { createNotification } from "@/lib/notifications"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; applicationId: string }> }
) {
  try {
    const { taskId, applicationId } = await params

    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { agent } = authResult

    if (!agent.operatorId) {
      return NextResponse.json({ error: "Agent has no linked operator" }, { status: 403 })
    }

    // Verify agent owns the task
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    if (task.creatorId !== agent.operatorId) {
      return NextResponse.json({ error: "Only the task creator can manage applications" }, { status: 403 })
    }

    // Get the application
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        agent: { select: { id: true, name: true, operatorId: true } },
      },
    })
    if (!application || application.taskId !== taskId) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }
    if (application.status !== ApplicationStatus.PENDING) {
      return NextResponse.json({ error: `Application is already ${application.status}` }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json({ error: 'Action must be "accept" or "reject"' }, { status: 400 })
    }

    if (action === "accept") {
      const updateResult = await prisma.task.updateMany({
        where: { id: taskId, currentWorkers: { lt: task.maxWorkers } },
        data: { currentWorkers: { increment: 1 } },
      })

      if (updateResult.count === 0) {
        return NextResponse.json({ error: "Task is full — all worker slots have been filled" }, { status: 409 })
      }

      await prisma.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.ACCEPTED, acceptedAt: new Date() },
      })

      const updatedTask = await prisma.task.findUnique({ where: { id: taskId } })

      if (updatedTask && updatedTask.currentWorkers >= updatedTask.maxWorkers) {
        await prisma.application.updateMany({
          where: { taskId, status: ApplicationStatus.PENDING },
          data: { status: ApplicationStatus.REJECTED },
        })
      }

      if (updatedTask && updatedTask.status === TaskStatus.ACTIVE && updatedTask.currentWorkers === 1) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.IN_PROGRESS },
        })
      }

      await createSystemMessage(taskId, `${application.agent.name} was accepted and assigned to this task.`).catch(() => {})

      if (application.agent.operatorId) {
        createNotification(
          application.agent.operatorId,
          "APPLICATION_ACCEPTED",
          "Application accepted!",
          `${application.agent.name} was accepted for "${task.title}"`,
          `/tasks/${taskId}`
        ).catch(() => {})
      }

      return NextResponse.json({ success: true, status: "ACCEPTED" })
    }

    // Reject
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.REJECTED },
    })

    await createSystemMessage(taskId, `${application.agent.name}'s application was declined.`).catch(() => {})

    return NextResponse.json({ success: true, status: "REJECTED" })
  } catch (error) {
    console.error("Agent application action error:", error)
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 })
  }
}
