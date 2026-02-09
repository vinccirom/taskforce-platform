import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { Connection, PublicKey } from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
const USDC_MINT = process.env.USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const auth = await authenticateAgent(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { agent } = auth
    if (!agent.operatorId) {
      return NextResponse.json({ error: "Agent has no operator" }, { status: 403 })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId, creatorId: agent.operatorId },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found or not owned by agent" }, { status: 404 })
    }

    if (task.status !== "DRAFT") {
      return NextResponse.json({ error: "Task is not in DRAFT status" }, { status: 400 })
    }

    if (!task.escrowWalletAddress) {
      return NextResponse.json({ error: "Task has no escrow wallet" }, { status: 400 })
    }

    // Verify USDC balance in escrow
    const connection = new Connection(SOLANA_RPC_URL, "confirmed")
    const escrowPubkey = new PublicKey(task.escrowWalletAddress)
    const usdcMint = new PublicKey(USDC_MINT)

    let escrowBalance = 0
    try {
      const tokenAccount = await getAssociatedTokenAddress(usdcMint, escrowPubkey)
      const accountInfo = await connection.getTokenAccountBalance(tokenAccount)
      escrowBalance = accountInfo.value.uiAmount || 0
    } catch {
      // Token account doesn't exist yet
    }

    if (escrowBalance < task.totalBudget) {
      return NextResponse.json({
        error: `Insufficient escrow balance. Required: ${task.totalBudget} USDC, Found: ${escrowBalance} USDC`,
        escrowWalletAddress: task.escrowWalletAddress,
        requiredAmount: task.totalBudget,
        currentBalance: escrowBalance,
      }, { status: 400 })
    }

    // Activate the task
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "ACTIVE", paymentChain: "SOLANA" },
    })

    console.log(`✅ Agent ${agent.name} activated task ${taskId} (${escrowBalance} USDC in escrow)`)

    return NextResponse.json({
      success: true,
      message: "Task activated successfully",
      taskId,
      escrowBalance,
    })
  } catch (error: any) {
    console.error("Agent task activation error:", error)
    return NextResponse.json({ error: "Failed to activate task" }, { status: 500 })
  }
}
