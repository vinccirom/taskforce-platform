import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MilestoneStatus, TaskStatus, UserRole } from '@prisma/client';
import { transferUsdcToAgent } from '@/lib/payment';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> }
) {
  try {
    // Authenticate creator
    const privyUser = await getAuthUser();

    if (!privyUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { privyId: privyUser.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Role check removed — any authenticated user can access

    const { milestoneId } = await params;
    const body = await request.json();
    const { feedback } = body;

    // Fetch milestone with task details
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        task: {
          include: {
            creator: true,
            applications: {
              where: {
                status: 'ACCEPTED',
              },
              include: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    walletAddress: true,
                    operatorId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    // Verify creator owns this task
    if (milestone.task.creatorId !== user.id && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Not authorized to approve this milestone' },
        { status: 403 }
      );
    }

    // Verify milestone is under review
    if (milestone.status !== MilestoneStatus.UNDER_REVIEW) {
      return NextResponse.json(
        { error: `Milestone must be under review to approve (current status: ${milestone.status})` },
        { status: 400 }
      );
    }

    // Update milestone to completed
    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    console.log(`✅ Milestone ${milestoneId} approved - payment ready for release`);

    // Notify workers of approval
    for (const app of milestone.task.applications) {
      if (app.agent.operatorId) {
        createNotification(
          app.agent.operatorId,
          "MILESTONE_APPROVED",
          "Milestone approved!",
          `Milestone "${milestone.title}" on "${milestone.task.title}" was approved`,
          `/my-tasks`
        ).catch(() => {})
      }
    }

    // Check if all milestones for this task are now completed
    const allMilestones = await prisma.milestone.findMany({
      where: { taskId: milestone.taskId },
    });

    const allCompleted = allMilestones.every(m => m.status === MilestoneStatus.COMPLETED);
    if (allCompleted) {
      await prisma.task.update({
        where: { id: milestone.taskId },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      console.log(`🎉 Task ${milestone.taskId} auto-completed — all milestones done`);
    }

    // Pay the accepted worker for this milestone
    let payoutResult: any = null
    const acceptedApp = milestone.task.applications[0] // First accepted worker
    if (acceptedApp?.agent?.walletAddress && milestone.amount) {
      payoutResult = await transferUsdcToAgent(
        acceptedApp.agent.walletAddress,
        milestone.amount,
        milestone.task.escrowWalletId ?? undefined,
        milestone.task.escrowWalletAddress ?? undefined,
      )

      if (payoutResult.success) {
        console.log(`💰 Milestone ${milestoneId} payout: ${milestone.amount} USDC to ${acceptedApp.agent.name}`)
      } else {
        console.error(`⚠️ Milestone ${milestoneId} payout failed: ${payoutResult.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      milestone: updatedMilestone,
      message: payoutResult?.success
        ? `Milestone approved! ${milestone.amount} USDC released to worker.`
        : 'Milestone approved! Payment will be processed.',
      transactionHash: payoutResult?.transactionHash,
    });

  } catch (error: any) {
    console.error('❌ Milestone approval error:', error);
    return NextResponse.json(
      { error: 'Failed to approve milestone' },
      { status: 500 }
    );
  }
}
