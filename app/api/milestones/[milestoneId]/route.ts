import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> }
) {
  try {
    // Authenticate user (can be creator or agent)
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

    const { milestoneId } = await params;

    // Fetch milestone with full details
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        task: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            applications: {
              where: {
                status: 'ACCEPTED',
              },
              include: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    operatorId: true,
                  },
                },
              },
            },
          },
        },
        evidence: {
          orderBy: {
            createdAt: 'desc',
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

    // Verify user has access to this milestone
    const isCreator = milestone.task.creatorId === user.id;
    const isAssignedAgent = milestone.task.applications.some(
      app => app.agent.operatorId === user.id
    );
    const isAdmin = user.role === 'ADMIN';

    if (!isCreator && !isAssignedAgent && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to view this milestone' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      milestone: {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        order: milestone.order,
        percentage: milestone.percentage,
        amount: milestone.amount,
        status: milestone.status,
        dueDate: milestone.dueDate,
        completedAt: milestone.completedAt,
        deliverable: milestone.deliverable,
        createdAt: milestone.createdAt,
        updatedAt: milestone.updatedAt,
        task: {
          id: milestone.task.id,
          title: milestone.task.title,
          category: milestone.task.category,
        },
        evidence: milestone.evidence,
      },
    });

  } catch (error: any) {
    console.error('❌ Milestone fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestone' },
      { status: 500 }
    );
  }
}
