import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, TaskStatus, PayoutStatus, MilestoneStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
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

    const userId = user.id;

    // Get all tasks for this creator
    const tasks = await prisma.task.findMany({
      where: {
        creatorId: userId,
      },
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
              },
            },
          },
        },
        submissions: {
          where: {
            status: 'APPROVED',
          },
        },
        milestones: true,
      },
    });

    // Calculate treasury stats
    let available = 0;
    let allocated = 0;
    let paidOut = 0;

    const activeTasks: any[] = [];
    const paymentHistory: any[] = [];

    for (const task of tasks) {
      const totalBudget = task.totalBudget;

      // Calculate how much has been paid out
      let taskPaidOut = 0;

      // For FIXED payment tasks
      if (task.paymentType === 'FIXED') {
        for (const submission of task.submissions) {
          if (submission.payoutStatus === PayoutStatus.PAID) {
            taskPaidOut += submission.payoutAmount || task.paymentPerWorker || task.totalBudget;

            paymentHistory.push({
              id: submission.id,
              date: submission.paidAt || submission.submittedAt,
              taskTitle: task.title,
              taskId: task.id,
              workerName: task.applications.find(a => a.agentId === submission.agentId)?.agent.name || 'Unknown',
              amount: submission.payoutAmount || task.paymentPerWorker || task.totalBudget,
              type: 'submission',
              status: 'completed',
            });
          }
        }
      }

      // For MILESTONE payment tasks
      if (task.paymentType === 'MILESTONE') {
        for (const milestone of task.milestones) {
          if (milestone.status === MilestoneStatus.COMPLETED) {
            taskPaidOut += milestone.amount;

            paymentHistory.push({
              id: milestone.id,
              date: milestone.completedAt || milestone.updatedAt,
              taskTitle: task.title,
              taskId: task.id,
              workerName: task.applications[0]?.agent.name || 'Unknown',
              amount: milestone.amount,
              type: 'milestone',
              milestoneTitle: milestone.title,
              status: 'completed',
            });
          }
        }
      }

      paidOut += taskPaidOut;

      // If task is active or in progress, remaining budget is allocated
      if (task.status === TaskStatus.ACTIVE || task.status === TaskStatus.IN_PROGRESS) {
        const remaining = totalBudget - taskPaidOut;
        allocated += remaining;

        if (remaining > 0) {
          activeTasks.push({
            id: task.id,
            title: task.title,
            category: task.category,
            status: task.status,
            totalBudget: task.totalBudget,
            allocatedAmount: totalBudget,
            paidAmount: taskPaidOut,
            paymentType: task.paymentType,
            milestonesCompleted: task.milestones.filter(m => m.status === MilestoneStatus.COMPLETED).length,
            milestonesTotal: task.milestones.length,
            deadline: task.deadline,
            workerName: task.applications[0]?.agent.name,
          });
        }
      }

      // If task is completed, any unpaid budget is available again
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
        const unpaid = totalBudget - taskPaidOut;
        if (unpaid > 0) {
          available += unpaid;
        }
      }
    }

    // Sort payment history by date (newest first)
    paymentHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      treasury: {
        available,
        allocated,
        paidOut,
        total: available + allocated + paidOut,
      },
      activeTasks,
      paymentHistory,
    });

  } catch (error: any) {
    console.error('❌ Treasury fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treasury data' },
      { status: 500 }
    );
  }
}
