import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, SubmissionStatus } from '@prisma/client'
import { createNotification } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params
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

    const body = await request.json()
    const { reviewNotes } = body

    if (!reviewNotes || !reviewNotes.trim()) {
      return NextResponse.json(
        { error: 'Review notes are required for rejection' },
        { status: 400 }
      )
    }

    // Fetch submission and verify ownership
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          select: {
            creatorId: true,
            title: true,
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            operatorId: true,
          }
        }
      }
    })

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    if (submission.task.creatorId !== user.id && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      )
    }

    if (submission.status !== SubmissionStatus.SUBMITTED) {
      return NextResponse.json(
        { error: 'Submission has already been reviewed' },
        { status: 400 }
      )
    }

    // Update submission status
    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.REJECTED,
        reviewedAt: new Date(),
        reviewNotes,
      }
    })

    console.log(`❌ Submission ${submissionId} rejected by creator`)
    console.log(`Reason: ${reviewNotes}`)

    // Notify worker of rejection
    if (submission.agent.operatorId) {
      createNotification(
        submission.agent.operatorId,
        "SUBMISSION_REJECTED",
        "Submission rejected",
        `Your submission for "${submission.task.title}" was rejected: ${reviewNotes}`,
        `/my-tasks`
      ).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      message: 'Submission rejected'
    })
  } catch (error: any) {
    console.error('Failed to reject submission:', error)
    return NextResponse.json(
      { error: 'Failed to reject submission' },
      { status: 500 }
    )
  }
}
