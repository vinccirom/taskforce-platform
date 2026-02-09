import { getAuthUser } from "@/lib/auth"
import { authenticateAgent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { checkPreAcceptanceLimit } from "@/lib/message-limits"
import { NextRequest, NextResponse } from "next/server"

// Helper to get the authenticated user ID (human or agent's operator)
async function getParticipant(request: NextRequest) {
  // Try agent API key first
  const apiKey = request.headers.get("X-API-Key")
  if (apiKey) {
    const result = await authenticateAgent(request)
    if ('agent' in result && result.agent.operatorId) {
      return { userId: result.agent.operatorId, agentId: result.agent.id }
    }
    if ('agent' in result) {
      // Agent without operator — find/create a user for this agent
      // For now, return null (agents need operators)
      return null
    }
    return null
  }

  // Try Privy auth
  const claims = await getAuthUser()
  if (!claims) return null
  const user = await prisma.user.findUnique({ where: { privyId: claims.userId } })
  if (!user) return null
  return { userId: user.id, agentId: null }
}

// Participant check helper — any applicant (any status) or creator
async function isTaskParticipant(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      applications: {
        include: { agent: { select: { id: true, operatorId: true } } }
      }
    }
  })
  if (!task) return { allowed: false, task: null }
  
  // Creator always allowed
  if (task.creatorId === userId) return { allowed: true, task }
  
  // Any applicant allowed (check agent's operator)
  const isApplicant = task.applications.some(app => app.agent.operatorId === userId)
  return { allowed: isApplicant, task }
}

// GET /api/tasks/[taskId]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const participant = await getParticipant(request)

    if (!participant) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is a participant
    const { allowed } = await isTaskParticipant(taskId, participant.userId)
    if (!allowed) {
      return NextResponse.json(
        { error: "You are not a participant in this task" },
        { status: 403 }
      )
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

    // Build query
    const where: any = { taskId }
    if (cursor) {
      where.id = { gt: cursor }
    }

    const messages = await prisma.taskMessage.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's more
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    // Check if there's a next page
    const hasMore = messages.length > limit
    const messagesToReturn = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore ? messagesToReturn[messagesToReturn.length - 1].id : undefined

    return NextResponse.json({
      messages: messagesToReturn,
      nextCursor
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}

// POST /api/tasks/[taskId]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const participant = await getParticipant(request)

    if (!participant) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is a participant
    const { allowed } = await isTaskParticipant(taskId, participant.userId)
    if (!allowed) {
      return NextResponse.json(
        { error: "You are not a participant in this task" },
        { status: 403 }
      )
    }

    // Get and validate body
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "Content must be 5000 characters or less" },
        { status: 400 }
      )
    }

    // Pre-acceptance rate limiting for pending applicants (not the creator)
    const { task: taskForLimit } = await isTaskParticipant(taskId, participant.userId)
    if (taskForLimit && taskForLimit.creatorId !== participant.userId) {
      const senderApp = taskForLimit.applications.find(
        (app: any) => app.agent.operatorId === participant.userId
      )
      if (senderApp && senderApp.status === "PENDING") {
        if (content.length > 1000) {
          return NextResponse.json(
            { error: "Message must be 1000 characters or less before your application is accepted" },
            { status: 400 }
          )
        }

        const existingMessages = await prisma.taskMessage.findMany({
          where: { taskId, senderId: participant.userId, type: "USER" },
          orderBy: { createdAt: "asc" },
          take: 1,
        })

        if (existingMessages.length > 0) {
          const creatorReply = await prisma.taskMessage.findFirst({
            where: {
              taskId,
              senderId: taskForLimit.creatorId,
              type: "USER",
              createdAt: { gt: existingMessages[0].createdAt },
            },
          })

          if (!creatorReply) {
            return NextResponse.json(
              { error: "You can send one message before your application is accepted. The creator will respond if interested." },
              { status: 400 }
            )
          }
        }
      }
    }

    // Create message
    const message = await prisma.taskMessage.create({
      data: {
        taskId,
        senderId: participant.userId,
        agentId: participant.agentId,
        content,
        type: "USER"
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    // Create notifications for other participants
    const { task } = await isTaskParticipant(taskId, participant.userId)
    if (task) {
      const creatorLink = `/tasks/${taskId}`
      const workerLink = `/browse/${taskId}`
      // Notify creator if sender is not creator
      if (task.creatorId !== participant.userId) {
        const existing = await prisma.notification.findFirst({
          where: { userId: task.creatorId, type: "NEW_MESSAGE", link: creatorLink, read: false }
        })
        if (!existing) {
          await createNotification({ userId: task.creatorId, type: "NEW_MESSAGE", title: "New Message", message: `New message in task "${task.title || taskId}"`, link: creatorLink })
        }
      }
      // Notify agents who applied
      for (const app of task.applications) {
        if (app.agent.operatorId === participant.userId) continue
        if (app.agent.operatorId) {
          const existing = await prisma.notification.findFirst({
            where: { userId: app.agent.operatorId, type: "NEW_MESSAGE", link: workerLink, read: false }
          })
          if (!existing) {
            await createNotification({ userId: app.agent.operatorId, agentId: app.agent.id, type: "NEW_MESSAGE", title: "New Message", message: `New message in task "${task.title || taskId}"`, link: workerLink })
          }
        } else {
          // Agent without operator — notify by agentId
          const existing = await prisma.notification.findFirst({
            where: { agentId: app.agent.id, type: "NEW_MESSAGE", link: workerLink, read: false }
          })
          if (!existing) {
            await createNotification({ agentId: app.agent.id, type: "NEW_MESSAGE", title: "New Message", message: `New message in task "${task.title || taskId}"`, link: workerLink })
          }
        }
      }
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    )
  }
}
