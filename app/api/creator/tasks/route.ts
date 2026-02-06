import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TaskStatus, UserRole, PaymentType } from '@prisma/client';
import { privyServer, PLATFORM_KEY_QUORUM_ID } from '@/lib/privy-server';
import { Keypair } from '@solana/web3.js';

export async function POST(request: NextRequest) {
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

    // Any authenticated user can create tasks

    const body = await request.json();
    const {
      title,
      description,
      referenceUrl,
      credentials,
      requirements,
      category,
      skillsRequired,
      totalBudget,
      paymentType,
      paymentPerWorker,
      maxWorkers,
      deadline,
      milestones,
    } = body;

    // Validation
    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    if (!requirements || typeof requirements !== 'string') {
      return NextResponse.json(
        { error: 'Requirements are required' },
        { status: 400 }
      );
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    if (!totalBudget || typeof totalBudget !== 'number' || totalBudget <= 0) {
      return NextResponse.json(
        { error: 'Valid total budget is required (must be > 0)' },
        { status: 400 }
      );
    }

    const taskPaymentType = paymentType || PaymentType.FIXED;
    const taskMaxWorkers = maxWorkers || 1;

    // Validate milestones if payment type is MILESTONE
    if (taskPaymentType === PaymentType.MILESTONE) {
      if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
        return NextResponse.json(
          { error: 'Milestones are required for milestone-based payments' },
          { status: 400 }
        );
      }

      // Validate milestone percentages sum to 100
      const totalPercentage = milestones.reduce((sum: number, m: any) => sum + (m.percentage || 0), 0);
      if (totalPercentage !== 100) {
        return NextResponse.json(
          { error: 'Milestone percentages must sum to 100%' },
          { status: 400 }
        );
      }
    }

    console.log(`💰 Creating task: ${title} - ${category} - ${totalBudget} USDC total`);

    // Create task record with DRAFT status
    // Task will be activated when creator sends USDC to platform wallet
    const task = await prisma.task.create({
      data: {
        creatorId: user.id,
        title,
        description,
        referenceUrl: referenceUrl || null,
        credentials: credentials || null,
        requirements,
        category,
        skillsRequired: skillsRequired || [],
        totalBudget,
        paymentType: taskPaymentType,
        paymentPerWorker: paymentPerWorker || null,
        maxWorkers: taskMaxWorkers,
        status: TaskStatus.DRAFT,
        deadline: deadline ? new Date(deadline) : null,
        // Create milestones if provided
        ...(milestones && milestones.length > 0 && {
          milestones: {
            create: milestones.map((m: any, index: number) => ({
              title: m.title,
              description: m.description || null,
              order: index + 1,
              percentage: m.percentage,
              amount: (totalBudget * m.percentage) / 100,
              dueDate: m.dueDate ? new Date(m.dueDate) : null,
            })),
          },
        }),
      },
      include: {
        milestones: true,
      },
    });

    console.log(`✅ Task created with ID: ${task.id}`);

    // Create per-task escrow wallet
    let escrowWalletId: string | null = null;
    let escrowWalletAddress: string | null = null;

    try {
      if (process.env.MOCK_TRANSFERS === 'true') {
        // MOCK MODE: Generate fake wallet credentials
        console.log('🎭 MOCK: Generating fake escrow wallet');
        escrowWalletId = `mock_wallet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        // Generate a random Solana-looking address (44 chars, base58)
        const randomKeypair = Keypair.generate();
        escrowWalletAddress = randomKeypair.publicKey.toBase58();
        console.log(`🎭 MOCK: Created fake wallet ${escrowWalletId} with address ${escrowWalletAddress}`);
      } else {
        // REAL MODE: Create Privy server wallet
        console.log('💳 Creating Privy escrow wallet for task...');
        const walletParams: any = {
          chain_type: 'solana',
        };

        // If PLATFORM_KEY_QUORUM_ID is set, use it as owner for server-controlled wallets
        if (PLATFORM_KEY_QUORUM_ID) {
          walletParams.owner_id = PLATFORM_KEY_QUORUM_ID;
        }

        const wallet = await privyServer.wallets().create(walletParams);
        escrowWalletId = wallet.id;
        escrowWalletAddress = wallet.address;
        console.log(`✅ Escrow wallet created: ${escrowWalletId} (${escrowWalletAddress})`);
      }

      // Update task with wallet details
      await prisma.task.update({
        where: { id: task.id },
        data: {
          escrowWalletId,
          escrowWalletAddress,
        },
      });

      console.log(`✅ Task ${task.id} updated with escrow wallet`);
    } catch (walletError: any) {
      console.error('⚠️ Wallet creation failed:', walletError.message);
      console.error('Task created but without escrow wallet. Can retry later.');
      // Continue — task is still created, just without escrow wallet yet
      // Creator can still send to platform wallet as fallback
    }

    // Return success — creator needs to send USDC to activate
    return NextResponse.json({
      success: true,
      taskId: task.id,
      totalAmount: totalBudget,
      message: 'Task created! Send USDC to activate.',
      paymentDetails: {
        amount: totalBudget,
        currency: 'USDC',
        paymentType: taskPaymentType,
        // Use task-specific escrow wallet if available, otherwise fallback to platform wallet
        platformWallet: escrowWalletAddress || process.env.PLATFORM_WALLET_ADDRESS || 'Contact admin for wallet address',
        escrowWalletAddress, // Include explicitly for clarity
        ...(taskPaymentType === PaymentType.MILESTONE && {
          milestones: task.milestones,
        }),
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Task creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create task. Please try again.' },
      { status: 500 }
    );
  }
}

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

    // Any authenticated user can view their tasks

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    // Build where clause
    const where: any = {
      creatorId: user.id,
    };

    if (status && Object.values(TaskStatus).includes(status as TaskStatus)) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    // Fetch tasks
    const tasks = await prisma.task.findMany({
      where,
      include: {
        applications: {
          include: {
            agent: true,
          },
        },
        submissions: true,
        milestones: {
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      tasks,
    });

  } catch (error: any) {
    console.error('❌ Task fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
