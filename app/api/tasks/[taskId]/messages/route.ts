import { getAuthUser } from "@/lib/auth"
import { authenticateAgent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
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

// Participant check helper
async function isTaskParticipant(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      applications: {
        where: { status: 'ACCEPTED' },
        include: { agent: { select: { operatorId: true } } }
      }
    }
  })
  if (!task) return { allowed: false, task: null }
  
  // Creator always allowed
  if (task.creatorId === userId) return { allowed: true, task }
  
  // Accepted workers allowed (check agent's operator)
  const isWorker = task.applications.some(app => app.agent.operatorId === userId)
  return { allowed: isWorker, task }
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

    // Create message
    const message = await prisma.taskMessage.create({
      data: {
        taskId,
        senderId: participant.userId,
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

    return NextResponse.json({ message })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    )
  }
}
