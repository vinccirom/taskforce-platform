import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, SubmissionStatus, PayoutStatus, TaskStatus, MilestoneStatus } from '@prisma/client'
import { transferUsdcToAgent } from '@/lib/payment'
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

    // Fetch submission and verify ownership
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          select: {
            creatorId: true,
            paymentPerWorker: true,
            title: true,
            escrowWalletId: true,
            escrowWalletAddress: true,
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
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
        status: SubmissionStatus.APPROVED,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        payoutAmount: submission.task.paymentPerWorker,
        payoutStatus: PayoutStatus.APPROVED,
      }
    })

    console.log(`✅ Submission ${submissionId} approved by creator`)
    console.log(`💰 Payout of ${submission.task.paymentPerWorker} USDC approved for agent ${submission.agent.name}`)

    // Notify worker of approval
    if (submission.agent.operatorId) {
      createNotification(
        submission.agent.operatorId,
        "SUBMISSION_APPROVED",
        "Submission approved!",
        `Your submission for "${submission.task.title}" was approved`,
        `/my-tasks`
      ).catch(() => {})
    }

    // Release funds from escrow to agent wallet
    if (submission.agent.walletAddress && submission.task.paymentPerWorker) {
      try {
        const transferResult = await transferUsdcToAgent(
          submission.agent.walletAddress,
          submission.task.paymentPerWorker,
          submission.task.escrowWalletId ?? undefined,
          submission.task.escrowWalletAddress ?? undefined,
        )

        if (transferResult.success) {
          await prisma.submission.update({
            where: { id: submissionId },
            data: {
              payoutStatus: PayoutStatus.PAID,
              paidAt: new Date(),
            },
          })
          console.log(`💸 Escrow released to ${submission.agent.name}: ${transferResult.transactionHash}`)
        } else {
          console.error(`⚠️ Escrow transfer failed for submission ${submissionId}: ${transferResult.error}`)
          // payoutStatus remains APPROVED — admin can retry manually
        }
      } catch (transferError) {
        console.error(`⚠️ Escrow transfer error for submission ${submissionId}:`, transferError)
        // payoutStatus remains APPROVED — admin can retry manually
      }
    }

    // Check if all milestones are completed — if so, mark task as COMPLETED
    const allMilestones = await prisma.milestone.findMany({
      where: { taskId: submission.taskId },
    });

    if (allMilestones.length > 0) {
      const allCompleted = allMilestones.every(m => m.status === MilestoneStatus.COMPLETED);
      if (allCompleted) {
        await prisma.task.update({
          where: { id: submission.taskId },
          data: {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
        console.log(`🎉 Task ${submission.taskId} auto-completed — all milestones done`);

        // Notify creator of task completion
        createNotification(
          submission.task.creatorId,
          "TASK_COMPLETED",
          "Task completed!",
          `All milestones for "${submission.task.title}" are done`,
          `/tasks/${submission.taskId}`
        ).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      message: 'Submission approved successfully'
    })
  } catch (error: any) {
    console.error('Failed to approve submission:', error)
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 }
    )
  }
}
