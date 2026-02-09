import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole, SubmissionStatus, TaskStatus, ApplicationStatus, MilestoneStatus } from "@prisma/client"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; applicationId: string }> }
) {
  try {
    const { taskId, applicationId } = await params
    const privyUser = await getAuthUser()

    if (!privyUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { privyId: privyUser.userId },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    return await releaseWorker(taskId, applicationId, user.id, user.role)
  } catch (error: any) {
    console.error("Failed to release worker:", error)
    return NextResponse.json({ error: "Failed to release worker" }, { status: 500 })
  }
}

export async function releaseWorker(
  taskId: string,
  applicationId: string,
  creatorId: string,
  userRole: string | null
) {
  // Fetch application with submission and task info
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      submission: {
        select: { id: true, status: true },
      },
      task: {
        select: {
          id: true,
          creatorId: true,
          title: true,
          currentWorkers: true,
          status: true,
        },
      },
      agent: {
        select: { id: true, name: true, operatorId: true },
      },
    },
  })

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  if (application.task.id !== taskId) {
    return NextResponse.json({ error: "Application does not belong to this task" }, { status: 404 })
  }

  if (application.task.creatorId !== creatorId && userRole !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  // Only allow release if the worker's submission is REJECTED
  if (!application.submission || application.submission.status !== SubmissionStatus.REJECTED) {
    return NextResponse.json(
      { error: "Can only release a worker whose submission has been rejected" },
      { status: 400 }
    )
  }

  if (application.status === ApplicationStatus.RELEASED) {
    return NextResponse.json({ error: "Worker has already been released" }, { status: 400 })
  }

  // Release the worker: update application status and decrement currentWorkers
  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.RELEASED },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { currentWorkers: { decrement: 1 } },
    }),
  ])

  console.log(`🔓 Worker ${application.agent.name} released from task ${taskId}`)

  // Notify the released worker
  if (application.agent.operatorId) {
    createNotification(
      application.agent.operatorId,
      "APPLICATION_REJECTED",
      "You've been released from a task",
      `You were released from "${application.task.title}" after your submission was rejected`,
      `/my-tasks`
    ).catch(() => {})
  }

  // Also notify the agent directly
  createNotification({
    agentId: application.agent.id,
    type: "APPLICATION_REJECTED",
    title: "Released from task",
    message: `You were released from "${application.task.title}" after your submission was rejected`,
    link: `/my-tasks`,
  }).catch(() => {})

  // Check if task should auto-complete now
  // (all remaining ACCEPTED workers have approved submissions)
  const allMilestones = await prisma.milestone.findMany({ where: { taskId } })
  let shouldComplete = false

  if (allMilestones.length > 0) {
    shouldComplete = allMilestones.every((m) => m.status === MilestoneStatus.COMPLETED)
  } else {
    const acceptedApplications = await prisma.application.count({
      where: { taskId, status: ApplicationStatus.ACCEPTED },
    })
    const approvedSubmissions = await prisma.submission.count({
      where: { taskId, status: SubmissionStatus.APPROVED },
    })
    shouldComplete = acceptedApplications > 0 && approvedSubmissions >= acceptedApplications
  }

  if (shouldComplete) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
    })
    console.log(`🎉 Task ${taskId} auto-completed after worker release`)

    createNotification(
      application.task.creatorId,
      "TASK_COMPLETED",
      "Task completed!",
      `All work for "${application.task.title}" has been approved`,
      `/tasks/${taskId}`
    ).catch(() => {})
  }

  return NextResponse.json({
    success: true,
    message: shouldComplete
      ? "Worker released and task auto-completed"
      : "Worker released successfully",
    taskCompleted: shouldComplete,
  })
}
