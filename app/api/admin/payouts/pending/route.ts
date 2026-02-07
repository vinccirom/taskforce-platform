/**
 * Admin endpoint to list pending payouts
 * GET /api/admin/payouts/pending
 *
 * Returns all submissions and milestones awaiting payout approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { PayoutStatus, SubmissionStatus, MilestoneStatus, UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Admin authentication
    const privyUser = await getAuthUser()
    if (!privyUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    const caller = await prisma.user.findUnique({ where: { privyId: privyUser.userId } })
    if (!caller || caller.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Get all approved submissions with pending payouts (for FIXED payment tasks)
    const pendingSubmissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.APPROVED,
        payoutStatus: PayoutStatus.PENDING,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            walletAddress: true,
            status: true,
            totalEarnings: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            totalBudget: true,
            paymentPerWorker: true,
            paymentType: true,
          },
        },
        application: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'asc', // Oldest first
      },
    });

    // Get all completed milestones awaiting payout (for MILESTONE payment tasks)
    const pendingMilestones = await prisma.milestone.findMany({
      where: {
        status: MilestoneStatus.COMPLETED,
      },
      include: {
        task: {
          include: {
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
                    status: true,
                    totalEarnings: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    // Format submissions for response
    const submissionPayouts = pendingSubmissions.map((submission) => ({
      id: submission.id,
      type: 'submission' as const,
      submittedAt: submission.submittedAt,
      agent: {
        id: submission.agent.id,
        name: submission.agent.name,
        walletAddress: submission.agent.walletAddress,
        status: submission.agent.status,
      },
      task: {
        id: submission.task.id,
        title: submission.task.title,
      },
      amount: submission.task.paymentPerWorker || submission.task.totalBudget,
      feedback: submission.feedback.substring(0, 200), // Preview
      rating: submission.rating,
    }));

    // Format milestones for response
    const milestonePayouts = pendingMilestones.flatMap((milestone) =>
      milestone.task.applications.map((application) => ({
        id: milestone.id,
        type: 'milestone' as const,
        submittedAt: milestone.completedAt,
        agent: {
          id: application.agent.id,
          name: application.agent.name,
          walletAddress: application.agent.walletAddress,
          status: application.agent.status,
        },
        task: {
          id: milestone.task.id,
          title: milestone.task.title,
        },
        milestone: {
          title: milestone.title,
          order: milestone.order,
        },
        amount: milestone.amount,
        deliverable: milestone.deliverable?.substring(0, 200), // Preview
      }))
    );

    // Combine and sort by date
    const allPayouts = [...submissionPayouts, ...milestonePayouts].sort(
      (a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime()
    );

    // Calculate total pending amount
    const totalPending = allPayouts.reduce((sum, payout) => sum + payout.amount, 0);

    return NextResponse.json({
      pendingPayouts: allPayouts,
      summary: {
        totalPending: allPayouts.length,
        totalAmount: totalPending,
        byType: {
          submissions: submissionPayouts.length,
          milestones: milestonePayouts.length,
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch pending payouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending payouts' },
      { status: 500 }
    );
  }
}
