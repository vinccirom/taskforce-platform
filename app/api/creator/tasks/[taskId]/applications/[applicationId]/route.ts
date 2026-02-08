import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { ApplicationStatus, TaskStatus } from "@prisma/client"
import { createSystemMessage } from "@/lib/messages"
import { createNotification } from "@/lib/notifications"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; applicationId: string }> }
) {
  try {
    const { taskId, applicationId } = await params

    // Auth: Privy cookie auth
    const claims = await getAuthUser()
    if (!claims) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { privyId: claims.userId },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user is the task creator
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    if (task.creatorId !== user.id) {
      return NextResponse.json({ error: "Only the task creator can manage applications" }, { status: 403 })
    }

    // Get the application
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        agent: {
          select: { id: true, name: true, operatorId: true },
        },
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
      // Atomically increment currentWorkers only if slots available
      const updateResult = await prisma.task.updateMany({
        where: { id: taskId, currentWorkers: { lt: task.maxWorkers } },
        data: { currentWorkers: { increment: 1 } },
      })

      if (updateResult.count === 0) {
        return NextResponse.json(
          { error: "Task is full — all worker slots have been filled" },
          { status: 409 }
        )
      }

      // Update application
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      })

      // Refresh task to get updated currentWorkers
      const updatedTask = await prisma.task.findUnique({ where: { id: taskId } })

      // If task reached maxWorkers, auto-reject remaining PENDING applications
      if (updatedTask && updatedTask.currentWorkers >= updatedTask.maxWorkers) {
        await prisma.application.updateMany({
          where: {
            taskId,
            status: ApplicationStatus.PENDING,
          },
          data: { status: ApplicationStatus.REJECTED },
        })
      }

      // If task is ACTIVE and this is first worker, set to IN_PROGRESS
      if (updatedTask && updatedTask.status === TaskStatus.ACTIVE && updatedTask.currentWorkers === 1) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.IN_PROGRESS },
        })
      }

      // System message
      await createSystemMessage(taskId, `${application.agent.name} was accepted and assigned to this task.`).catch(() => {})

      // Notify agent's operator
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
    console.error("Application action error:", error)
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 })
  }
}
