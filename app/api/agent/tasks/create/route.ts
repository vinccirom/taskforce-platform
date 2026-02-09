import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent, requireAgentStatus } from "@/lib/api-auth"
import { AgentStatus, TaskStatus, PaymentType } from "@prisma/client"
import { privyServer, PLATFORM_KEY_QUORUM_ID } from "@/lib/privy-server"
import { Keypair } from "@solana/web3.js"

export async function POST(request: NextRequest) {
  try {
    // Authenticate agent via API key
    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { agent } = authResult

    // Check agent status - must be at least VERIFIED_CAPABILITY
    const statusCheck = await requireAgentStatus(agent, AgentStatus.VERIFIED_CAPABILITY)
    if (!statusCheck.authorized) {
      return NextResponse.json(
        {
          error: statusCheck.error,
          hint: "Complete the trial task to unlock task creation"
        },
        { status: 403 }
      )
    }

    // Resolve or create the User who will own the task
    let user
    if (agent.operatorId) {
      // Agent has an operator - use that user as the creator
      user = await prisma.user.findUnique({
        where: { id: agent.operatorId },
      })
      if (!user) {
        return NextResponse.json(
          { error: "Agent operator user not found" },
          { status: 500 }
        )
      }
    } else {
      // No operator - auto-create a user for this agent
      const syntheticEmail = `agent-${agent.id}@taskforce.agent`
      user = await prisma.user.findUnique({
        where: { email: syntheticEmail },
      })

      if (!user) {
        console.log(`🤖 Auto-creating user for agent ${agent.id} (${agent.name})`)
        user = await prisma.user.create({
          data: {
            email: syntheticEmail,
            name: agent.name,
          },
        })
      }

      // Link agent to the new user
      await prisma.agent.update({
        where: { id: agent.id },
        data: { operatorId: user.id },
      })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

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
    } = body

    // Validation
    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // M-20: Length and value constraints
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or fewer' },
        { status: 400 }
      )
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    if (description.length > 10000) {
      return NextResponse.json(
        { error: 'Description must be 10,000 characters or fewer' },
        { status: 400 }
      )
    }

    if (!requirements || typeof requirements !== 'string') {
      return NextResponse.json(
        { error: 'Requirements are required' },
        { status: 400 }
      )
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    if (!totalBudget || typeof totalBudget !== 'number' || totalBudget <= 0) {
      return NextResponse.json(
        { error: 'Valid total budget is required (must be > 0)' },
        { status: 400 }
      )
    }

    if (totalBudget > 1000000) {
      return NextResponse.json(
        { error: 'Total budget exceeds maximum allowed' },
        { status: 400 }
      )
    }

    const taskPaymentType = paymentType || PaymentType.FIXED
    const taskMaxWorkers = typeof maxWorkers === 'number' && maxWorkers >= 1 && maxWorkers <= 100
      ? Math.floor(maxWorkers)
      : 1

    // Validate deadline is in the future
    if (deadline) {
      const deadlineDate = new Date(deadline)
      if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
        return NextResponse.json(
          { error: 'Deadline must be a valid future date' },
          { status: 400 }
        )
      }
    }

    // Validate milestones if payment type is MILESTONE
    if (taskPaymentType === PaymentType.MILESTONE) {
      if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
        return NextResponse.json(
          { error: 'Milestones are required for milestone-based payments' },
          { status: 400 }
        )
      }

      // Validate milestone percentages sum to 100
      const totalPercentage = milestones.reduce((sum: number, m: any) => sum + (m.percentage || 0), 0)
      if (totalPercentage !== 100) {
        return NextResponse.json(
          { error: 'Milestone percentages must sum to 100%' },
          { status: 400 }
        )
      }
    }

    console.log(`🤖 Agent ${agent.name} creating task: ${title} - ${category} - ${totalBudget} USDC total`)

    // Create task record with DRAFT status
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
        paymentPerWorker: paymentPerWorker || (totalBudget / taskMaxWorkers),
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
    })

    console.log(`✅ Task created with ID: ${task.id}`)

    // Create per-task escrow wallet
    let escrowWalletId: string | null = null
    let escrowWalletAddress: string | null = null

    try {
      if (process.env.MOCK_TRANSFERS === 'true' && process.env.NODE_ENV !== 'production') {
        // MOCK MODE: Generate fake wallet credentials
        console.log('🎭 MOCK: Generating fake escrow wallet')
        escrowWalletId = `mock_wallet_${Date.now()}_${Math.random().toString(36).substring(7)}`
        // Generate a random Solana-looking address (44 chars, base58)
        const randomKeypair = Keypair.generate()
        escrowWalletAddress = randomKeypair.publicKey.toBase58()
        console.log(`🎭 MOCK: Created fake wallet ${escrowWalletId} with address ${escrowWalletAddress}`)
      } else {
        // REAL MODE: Create Privy server wallet
        console.log('💳 Creating Privy escrow wallet for task...')
        const walletParams: any = {
          chain_type: 'solana',
        }

        // If PLATFORM_KEY_QUORUM_ID is set, use it as owner for server-controlled wallets
        if (PLATFORM_KEY_QUORUM_ID) {
          walletParams.owner_id = PLATFORM_KEY_QUORUM_ID
        }

        const wallet = await privyServer.wallets().create(walletParams)
        escrowWalletId = wallet.id
        escrowWalletAddress = wallet.address
        console.log(`✅ Escrow wallet created: ${escrowWalletId} (${escrowWalletAddress})`)
      }

      // Update task with wallet details
      await prisma.task.update({
        where: { id: task.id },
        data: {
          escrowWalletId,
          escrowWalletAddress,
        },
      })

      console.log(`✅ Task ${task.id} updated with escrow wallet`)
    } catch (walletError: any) {
      console.error('⚠️ Wallet creation failed:', walletError.message)
      console.error('Task created but without escrow wallet. Can retry later.')
      // Continue — task is still created, just without escrow wallet yet
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
      agent: {
        id: agent.id,
        name: agent.name,
      },
    }, { status: 201 })

  } catch (error: any) {
    console.error('❌ Agent task creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create task. Please try again.' },
      { status: 500 }
    )
  }
}
