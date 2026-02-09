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
            totalBudget: true,
            maxWorkers: true,
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

    // Calculate payout: paymentPerWorker if set, else totalBudget / maxWorkers
    const payoutAmount = submission.task.paymentPerWorker
      ?? (submission.task.totalBudget / (submission.task.maxWorkers || 1))

    // Atomic conditional update: only approve if still SUBMITTED (prevents race condition)
    const updateResult = await prisma.submission.updateMany({
      where: { id: submissionId, status: SubmissionStatus.SUBMITTED },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        payoutAmount,
        payoutStatus: PayoutStatus.PROCESSING,
      }
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'Submission has already been reviewed' },
        { status: 409 }
      )
    }

    const updatedSubmission = await prisma.submission.findUnique({
      where: { id: submissionId },
    })

    console.log(`✅ Submission ${submissionId} approved by creator`)
    console.log(`💰 Payout of ${payoutAmount} USDC approved for agent ${submission.agent.name}`)

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
    if (submission.agent.walletAddress && payoutAmount > 0) {
      try {
        const transferResult = await transferUsdcToAgent(
          submission.agent.walletAddress,
          payoutAmount,
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

          // Update agent earnings & stats
          await prisma.agent.update({
            where: { id: submission.agent.id },
            data: {
              totalEarnings: { increment: payoutAmount },
              completedTests: { increment: 1 },
            },
          })

          // Update application payment tracking
          await prisma.application.update({
            where: { id: submission.applicationId },
            data: {
              paidAmount: payoutAmount,
              paidAt: new Date(),
            },
          })

          console.log(`💸 Escrow released to ${submission.agent.name}: ${transferResult.transactionHash}`)
        } else {
          const errMsg = transferResult.error || 'Unknown transfer error'
          console.error(`⚠️ Escrow transfer failed for submission ${submissionId}: ${errMsg}`)
          await prisma.submission.update({
            where: { id: submissionId },
            data: {
              payoutStatus: PayoutStatus.FAILED,
              reviewNotes: `[PAYOUT FAILED] ${errMsg}${reviewNotes ? ` | Creator notes: ${reviewNotes}` : ''}`,
            },
          })
        }
      } catch (transferError: any) {
        const errMsg = transferError?.message || String(transferError)
        console.error(`⚠️ Escrow transfer error for submission ${submissionId}:`, transferError)
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            payoutStatus: PayoutStatus.FAILED,
            reviewNotes: `[PAYOUT ERROR] ${errMsg}${reviewNotes ? ` | Creator notes: ${reviewNotes}` : ''}`,
          },
        })
      }
    }

    // Check if task should auto-complete
    const allMilestones = await prisma.milestone.findMany({
      where: { taskId: submission.taskId },
    });

    // Auto-complete if: (a) all milestones done, OR (b) no milestones and all accepted workers' submissions approved
    let shouldComplete = false;

    if (allMilestones.length > 0) {
      shouldComplete = allMilestones.every(m => m.status === MilestoneStatus.COMPLETED);
    } else {
      // For multi-worker tasks: all accepted workers must have an approved submission
      const acceptedApplications = await prisma.application.count({
        where: { taskId: submission.taskId, status: "ACCEPTED" },
      });
      const approvedSubmissions = await prisma.submission.count({
        where: { taskId: submission.taskId, status: SubmissionStatus.APPROVED },
      });
      shouldComplete = acceptedApplications > 0 && approvedSubmissions >= acceptedApplications;
    }

    if (shouldComplete) {
      await prisma.task.update({
        where: { id: submission.taskId },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      console.log(`🎉 Task ${submission.taskId} auto-completed`);

      createNotification(
        submission.task.creatorId,
        "TASK_COMPLETED",
        "Task completed!",
        `All work for "${submission.task.title}" has been approved`,
        `/tasks/${submission.taskId}`
      ).catch(() => {})
    }

    // Fetch final payout status for response
    const finalSubmission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true, payoutStatus: true, payoutAmount: true, paidAt: true },
    })

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      payout: {
        status: finalSubmission?.payoutStatus,
        amount: finalSubmission?.payoutAmount,
        paidAt: finalSubmission?.paidAt,
      },
      message: finalSubmission?.payoutStatus === 'PAID' 
        ? 'Submission approved and payment released!' 
        : finalSubmission?.payoutStatus === 'FAILED'
        ? 'Submission approved but payment failed — check Vercel logs for details'
        : 'Submission approved successfully'
    })
  } catch (error: any) {
    console.error('Failed to approve submission:', error)
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 }
    )
  }
}
