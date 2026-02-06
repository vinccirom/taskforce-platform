import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAgent } from '@/lib/api-auth';
import { MilestoneStatus, TaskStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> }
) {
  try {
    // Authenticate agent
    const authResult = await authenticateAgent(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { agent } = authResult;
    const { milestoneId } = await params;
    const body = await request.json();
    const { deliverable, evidenceUrls } = body;

    // Validation
    if (!deliverable || typeof deliverable !== 'string') {
      return NextResponse.json(
        { error: 'Deliverable description is required' },
        { status: 400 }
      );
    }

    // Fetch milestone with task and application details
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        task: {
          include: {
            applications: {
              where: {
                agentId: agent.id,
                status: 'ACCEPTED',
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

    // Verify agent is assigned to this task
    if (milestone.task.applications.length === 0) {
      return NextResponse.json(
        { error: 'You are not assigned to this task' },
        { status: 403 }
      );
    }

    // Verify milestone is in progress
    if (milestone.status !== MilestoneStatus.IN_PROGRESS && milestone.status !== MilestoneStatus.PENDING) {
      return NextResponse.json(
        { error: `Milestone cannot be submitted (current status: ${milestone.status})` },
        { status: 400 }
      );
    }

    // Update milestone to under review
    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: MilestoneStatus.UNDER_REVIEW,
        deliverable,
      },
    });

    // Create evidence records if provided
    if (evidenceUrls && Array.isArray(evidenceUrls) && evidenceUrls.length > 0) {
      await prisma.evidence.createMany({
        data: evidenceUrls.map((url: string) => ({
          milestoneId: milestone.id,
          url,
          type: detectEvidenceType(url),
          filename: extractFilename(url),
        })),
      });
    }

    // Move task to IN_PROGRESS if still ACTIVE
    if (milestone.task.status === TaskStatus.ACTIVE) {
      await prisma.task.update({
        where: { id: milestone.task.id },
        data: { status: TaskStatus.IN_PROGRESS },
      })
    }

    console.log(`📤 Milestone ${milestoneId} submitted for review by agent ${agent.id}`);

    return NextResponse.json({
      success: true,
      milestone: updatedMilestone,
      message: 'Milestone submitted for review!',
    });

  } catch (error: any) {
    console.error('❌ Milestone submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit milestone' },
      { status: 500 }
    );
  }
}

function detectEvidenceType(url: string): string {
  const lower = url.toLowerCase()
  if (/\.(png|jpg|jpeg|gif|webp|svg)/.test(lower)) return "screenshot"
  if (/\.(pdf|doc|docx|txt|csv)/.test(lower)) return "document"
  if (/\.(js|ts|html|css|json|py|jsx|tsx)/.test(lower)) return "code"
  if (/\.(zip|gz|tar|rar|7z)/.test(lower)) return "archive"
  return "screenshot" // default
}

function extractFilename(url: string): string {
  try {
    const parts = url.split("/")
    const last = parts[parts.length - 1]
    // Remove query params and timestamp prefix
    return last.split("?")[0].replace(/^\d+-/, "")
  } catch {
    return "unknown"
  }
}
