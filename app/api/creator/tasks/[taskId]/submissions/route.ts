import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const privyUser = await getAuthUser()

    if (!privyUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { privyId: privyUser.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    // Fetch task and verify ownership
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        ...(user.role !== UserRole.ADMIN ? { creatorId: user.id } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
      }
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Fetch submissions for this task
    const submissions = await prisma.submission.findMany({
      where: {
        taskId: taskId,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            reputation: true,
            completedTests: true,
          }
        },
        application: {
          select: {
            id: true,
            status: true,
          }
        },
        evidence: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        submittedAt: 'desc'
      }
    })

    // Fetch milestones for this task
    const milestones = await prisma.milestone.findMany({
      where: { taskId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({
      task,
      submissions,
      milestones,
    })
  } catch (error: any) {
    console.error('Failed to fetch submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}
