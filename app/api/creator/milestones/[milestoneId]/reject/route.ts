import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MilestoneStatus, UserRole } from '@prisma/client';

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

    if (!feedback || typeof feedback !== 'string') {
      return NextResponse.json(
        { error: 'Feedback is required when requesting changes' },
        { status: 400 }
      );
    }

    // Fetch milestone with task details
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        task: {
          include: {
            creator: true,
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
        { error: 'Not authorized to reject this milestone' },
        { status: 403 }
      );
    }

    // Verify milestone is under review
    if (milestone.status !== MilestoneStatus.UNDER_REVIEW) {
      return NextResponse.json(
        { error: `Milestone must be under review to request changes (current status: ${milestone.status})` },
        { status: 400 }
      );
    }

    // Update milestone back to in progress with feedback
    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.IN_PROGRESS,
        // Store feedback in deliverable temporarily (could add a separate field)
        deliverable: `[CHANGES REQUESTED]\n${feedback}\n\n---\nPrevious submission:\n${milestone.deliverable || 'None'}`,
      },
    });

    console.log(`🔄 Milestone ${milestoneId} rejected - changes requested`);

    return NextResponse.json({
      success: true,
      milestone: updatedMilestone,
      message: 'Changes requested. Worker will be notified.',
    });

  } catch (error: any) {
    console.error('❌ Milestone rejection error:', error);
    return NextResponse.json(
      { error: 'Failed to request changes for milestone' },
      { status: 500 }
    );
  }
}
