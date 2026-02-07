/**
 * Admin endpoint to approve and process payouts
 * POST /api/admin/payouts/approve
 *
 * Approves a submission and transfers USDC to agent's wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { transferUsdcToAgent } from '@/lib/payment';
import { PayoutStatus, SubmissionStatus, UserRole } from '@prisma/client';

export async function POST(request: NextRequest) {
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

    const { submissionId } = await request.json();

    if (!submissionId) {
      return NextResponse.json(
        { error: 'Submission ID is required' },
        { status: 400 }
      );
    }

    // Get submission with related data
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
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
            maxWorkers: true,
            escrowWalletId: true,
            escrowWalletAddress: true,
          },
        },
        application: {
          select: { id: true },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Validation checks
    if (submission.status !== SubmissionStatus.SUBMITTED) {
      return NextResponse.json(
        { error: `Submission status must be SUBMITTED (current: ${submission.status})` },
        { status: 400 }
      );
    }

    if (submission.payoutStatus !== PayoutStatus.PENDING) {
      return NextResponse.json(
        { error: `Payout already processed (status: ${submission.payoutStatus})` },
        { status: 400 }
      );
    }

    if (!submission.agent.walletAddress) {
      return NextResponse.json(
        { error: 'Agent does not have a wallet address' },
        { status: 400 }
      );
    }

    // Calculate payout amount (from task payment, with safe fallback)
    const payoutAmount = submission.task.paymentPerWorker ?? (submission.task.totalBudget / (submission.task.maxWorkers || 1));

    console.log(`Processing payout for submission ${submissionId}:`);
    console.log(`  Agent: ${submission.agent.name} (${submission.agent.id})`);
    console.log(`  Amount: ${payoutAmount} USDC`);
    console.log(`  Wallet: ${submission.agent.walletAddress}`);
    console.log(`  Source: Task escrow ${submission.task.escrowWalletId || 'platform escrow (fallback)'}`);

    // Transfer USDC to agent from task's escrow wallet
    const transferResult = await transferUsdcToAgent(
      submission.agent.walletAddress,
      payoutAmount,
      submission.task.escrowWalletId || undefined,  // Use task escrow if available
      submission.task.escrowWalletAddress || undefined
    );

    if (!transferResult.success) {
      // Update submission with error
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          payoutStatus: PayoutStatus.DISPUTED,
          reviewNotes: `Payout failed: ${transferResult.error}`,
        },
      });

      return NextResponse.json(
        { error: `Transfer failed: ${transferResult.error}` },
        { status: 500 }
      );
    }

    // Update submission and agent stats
    await prisma.$transaction([
      // Update submission
      prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.APPROVED,
          payoutStatus: PayoutStatus.PAID,
          payoutAmount,
          paidAt: new Date(),
          reviewNotes: `Paid ${payoutAmount} USDC. TX: ${transferResult.transactionHash}`,
        },
      }),

      // Update agent stats
      prisma.agent.update({
        where: { id: submission.agentId },
        data: {
          totalEarnings: {
            increment: payoutAmount,
          },
          completedTests: {
            increment: 1,
          },
        },
      }),

      // Update application status
      prisma.application.update({
        where: { id: submission.applicationId },
        data: {
          status: 'COMPLETED',
        },
      }),
    ]);

    console.log(`✅ Payout successful! TX: ${transferResult.transactionHash}`);

    return NextResponse.json({
      success: true,
      message: 'Payout processed successfully',
      payout: {
        amount: payoutAmount,
        agentWallet: submission.agent.walletAddress,
        transactionHash: transferResult.transactionHash,
      },
    });
  } catch (error: any) {
    console.error('Payout processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process payout' },
      { status: 500 }
    );
  }
}
