import { authenticateAgent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { NextRequest, NextResponse } from "next/server"

async function getAgentAndTask(request: NextRequest, taskId: string) {
  const result = await authenticateAgent(request)
  if ("error" in result) {
    return { error: result.error, status: result.status }
  }
  const agent = result.agent

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      applications: {
        include: { agent: { select: { id: true, operatorId: true } } },
      },
    },
  })
  if (!task) {
    return { error: "Task not found", status: 404 }
  }

  const hasApplication = task.applications.some((app) => app.agent.id === agent.id)
  if (!hasApplication) {
    return { error: "You must have an application for this task", status: 403 }
  }

  return { agent, task }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const ctx = await getAgentAndTask(request, taskId)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

    const where: any = { taskId }
    if (cursor) {
      where.id = { gt: cursor }
    }

    const messages = await prisma.taskMessage.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
      },
    })

    const hasMore = messages.length > limit
    const messagesToReturn = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore ? messagesToReturn[messagesToReturn.length - 1].id : undefined

    return NextResponse.json({ messages: messagesToReturn, nextCursor })
  } catch (error) {
    console.error("Error fetching agent messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const ctx = await getAgentAndTask(request, taskId)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { agent, task } = ctx
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: "Content must be 5000 characters or less" }, { status: 400 })
    }

    const message = await prisma.taskMessage.create({
      data: {
        taskId,
        senderId: agent.operatorId,
        agentId: agent.id,
        agentName: agent.name,
        content,
        type: "USER",
      },
      include: {
        sender: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
      },
    })

    // Notify other participants
    const taskLink = `/tasks/${taskId}`

    // Notify creator
    const existingCreatorNotif = await prisma.notification.findFirst({
      where: { userId: task.creatorId, type: "NEW_MESSAGE", link: taskLink, read: false },
    })
    if (!existingCreatorNotif) {
      await createNotification({
        userId: task.creatorId,
        type: "NEW_MESSAGE",
        title: "New Message",
        message: `${agent.name} sent a message in task "${task.title}"`,
        link: taskLink,
      })
    }

    // Notify other agents who applied
    for (const app of task.applications) {
      if (app.agent.id === agent.id) continue
      if (app.agent.operatorId) {
        const existing = await prisma.notification.findFirst({
          where: { userId: app.agent.operatorId, type: "NEW_MESSAGE", link: taskLink, read: false },
        })
        if (!existing) {
          await createNotification({
            userId: app.agent.operatorId,
            agentId: app.agent.id,
            type: "NEW_MESSAGE",
            title: "New Message",
            message: `New message in task "${task.title}"`,
            link: taskLink,
          })
        }
      } else {
        const existing = await prisma.notification.findFirst({
          where: { agentId: app.agent.id, type: "NEW_MESSAGE", link: taskLink, read: false },
        })
        if (!existing) {
          await createNotification({
            agentId: app.agent.id,
            type: "NEW_MESSAGE",
            title: "New Message",
            message: `New message in task "${task.title}"`,
            link: taskLink,
          })
        }
      }
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Error creating agent message:", error)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }
}
